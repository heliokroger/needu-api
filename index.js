import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import password from 'password-hash-and-salt'
import elasticsearch from 'elasticsearch'
import cloudinary from 'cloudinary'
import http from 'http'
import sort from 'fast-sort'
import axios from 'axios'
import SocketIO from 'socket.io'

const elasticClient = new elasticsearch.Client({ host: 'localhost:9200' })

mongoose.connect('mongodb://localhost:27017/needu', { useNewUrlParser: true })

cloudinary.config({
    cloud_name: 'needu',
    api_key: '148252288734481',
    api_secret: '0V2qn8wdM5TAj-_2sNmmw4_1WLk'
})

const User = mongoose.model('User', {
    name: String,
    email: String,
    password: String,
    registeredAt: Date,
    avatar: String,
    fbId: String,
    avatar: {
        type: String,
        default: 'https://res.cloudinary.com/needu/image/upload/v1546382254/user-default.jpg'
    }
})

const app = express()

const server = http.Server(app)

const io = new SocketIO(server)

let connectedUsers = []

io.on('connection', socket => {
    connectedUsers.push({ id: socket.handshake.query.user, socket: socket.id })
    socket.on('message', async data => {
        try {
            const createMessage = conversation => {
                return new Promise(async (resolve, reject) => {
                    let response = await elasticClient.index({
                        index: 'messages',
                        type: 'message',
                        body: {
                            content: data.content,
                            sentAt: new Date(),
                            conversation: conversation,
                            sentBy: data.author
                        }
                    })
                    response = await elasticClient.get({
                        index: 'messages',
                        type: 'message',
                        id: response._id
                    })
                    resolve(normalize(response))
                })
            }
            let response = await elasticClient.search({
                index: 'conversations',
                type: 'conversation',
                body: {
                    query: {
                        bool: {
                            must: [
                                { multi_match: {
                                    query: data.author,
                                    fields: [ 'author', 'recipient' ]
                                } },
                                { multi_match: {
                                    query: data.recipient,
                                    fields: [ 'author', 'recipient' ]
                                } }
                            ]
                        }
                    }
                }
            })
            let conversation
            if (response.hits.hits.length) {
                conversation = normalize(response.hits.hits[0]).id
            } else {
                response = await elasticClient.index({
                    index: 'conversations',
                    type: 'conversation',
                    body: {
                        author: data.author,
                        recipient: data.recipient,
                        createdAt: new Date()
                    }
                })
                conversation = response._id
            }
            const message = await createMessage(conversation)
            const author = connectedUsers.find(user => user.id === data.author)
            const recipient = connectedUsers.find(user => user.id === data.recipient)
            if (author) io.to(author.socket).emit('message', message)
            if (recipient) io.to(recipient.socket).emit('message', message)
        } catch (err) {
            throw err
        }
    })
    socket.on('disconnect', () => {
        connectedUsers = connectedUsers.map(user => user.socket !== socket.id)
    })
})

app.use(bodyParser.json({ limit: '30MB' }))
app.use(cors())

const init = async () => {
    try {
        await elasticClient.indices.create({
            index: 'people',
            body: {
                mappings: {
                    person: {
                        properties: {
                            name: { type: 'text' },
                            address: { type: 'text' },
                            geometry: { type: 'number' },
                            createdAt: { type: 'date' },
                            photos: { type: 'text' },
                            user: { type: 'text' },
                            geometry: { type: 'geo_point' }
                        }
                    }
                }
            }
        })
        await elasticClient.indices.create({
            index: 'conversations',
            body: {
                mappings: {
                    conversation: {
                        properties: {
                            author: { type: 'text' },
                            recipient: { type: 'text' },
                            createdAt: { type: 'date' }
                        }
                    }
                }
            }
        })
        await elasticClient.indices.create({
            index: 'messages',
            body: {
                mappings: {
                    message: {
                        properties: {
                            content: { type: 'text' },
                            sentAt: { type: 'date' },
                            conversation: { type: 'text' },
                            sentBy: { type: 'text' }
                        }
                    }
                }
            }
        })
    } catch (err) {
        throw err
    }
}

// init()

const normalize = result => {
    let newResult
    if (Array.isArray(result)) {
        newResult = []
        newResult = result.map(item => ({ ...item._source, id: item._id }))
    } else {
        newResult = { ...result._source, id: result._id }
    }
    return newResult
}

app.get('/people/:lat,:lon', async (req, res) => {
    try {
        let response = await elasticClient.search({
            index: 'people',
            type: 'person',
            body: {
                query: {
                    bool: {
                        must: {
                            geo_distance: {
                                distance: '100km',
                                geometry: [
                                    parseFloat(req.params.lat),
                                    parseFloat(req.params.lon)
                                ]
                            }
                        }
                    }
                }
            }
        })
        const normalizedResponse = normalize(response.hits.hits)
        const people = await Promise.all(normalizedResponse.map(async person => {
            const user = await User.findById(person.user)
            person.user = user
            return person
        }))
        response = await axios.get('http://localhost:8080/mg')
        const policePeople = response.data.map(person => ({
            ...person,
            user: {
                name: 'Equipe NeedU',
                avatar: 'https://res.cloudinary.com/needu/image/upload/v1546541356/icon4.png'
            }
        }))
        res.json(people.concat(policePeople))
    } catch (err) {
        throw err
    }
})

app.get('/people/:lat,:lon/:filters', async (req, res) => {
    try {
        const filters = JSON.parse(req.params.filters)
        const response = await elasticClient.search({
            index: 'people',
            type: 'person',
            body: {
                query: {
                    bool: {
                        must: {
                            geo_distance: {
                                distance: `${filters.distance}km`,
                                geometry: [
                                    parseFloat(req.params.lat),
                                    parseFloat(req.params.lon)
                                ]
                            }
                        }
                    },
                    bool: {
                        should: [
                            { wildcard: { name: `*${filters.word}*` } },
                            { wildcard: { address: `*${filters.word}*` } }
                        ]
                    }
                }
            }
        })
        const normalizedResponse = normalize(response.hits.hits)
        const people = await Promise.all(normalizedResponse.map(async person => {
            const user = await User.findById(person.user)
            person.user = user
            return person
        }))
        res.json(people)
    } catch (err) {
        throw err
    }
})

app.get('/people/:id', async (req, res) => {
    try {
        const response = await elasticClient.get({
            index: 'people',
            type: 'person',
            id: req.params.id
        })
        const person = normalize(response)
        const user = await User.findById(person.user)
        person.user = user
        res.json(person)
    } catch (err) {
        throw err
    }
})

const cloudinaryUpload = file => {
    return new Promise((resolve, reject) => {
        cloudinary.v2.uploader.upload(file, (err, result) => {
            if (err) reject(err)
            resolve(result)
        })
    })
}

app.post('/people', async (req, res) => {
    const uploadPhotos = photos => {
        return new Promise(async (resolve, reject) => {
            const newPhotos = await Promise.all(photos.map(async photo => {
                const result = await cloudinaryUpload(photo)
                return result.secure_url
            }))
            resolve(newPhotos)
        })
    }
    try {
        const photos = await uploadPhotos(req.body.photos)
        let response = await elasticClient.index({
            index: 'people',
            type: 'person',
            body: {
                name: req.body.name,
                address: req.body.address,
                geometry: req.body.geometry,
                photos: photos,
                user: req.body.user,
                createdAt: new Date()
            }
        })
        response = await elasticClient.get({
            index: 'people',
            type: 'person',
            id: response._id
        })
        res.json(normalize(response))
    } catch (err) {
        throw err
    }
})

app.post('/authentication/facebook', async (req, res) => {
    try {
        const user = await User.findOne({ fbId: req.body.fbId })
        if (user) {
            res.json(user)
        } else {
            const newUser = await User.create({ ...req.body, registeredAt: new Date() })
            res.json(newUser)
        }
    } catch (err) {
        throw err
    }
})

app.post('/authentication/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email })
        if (user) {
            password(req.body.password).verifyAgainst(user.password, (err, verified) => {
                if (err) throw err
                if (verified) {
                    res.json(user)
                } else {
                    res.status(400)
                    res.json('Invalid password')
                }
            })
        } else {
            res.status(400)
            res.json('Email not found')
        }
    } catch (err) {
        throw err
    }
})

app.post('/authentication/register', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email })
        if (user) {
            res.status(400)
            res.json('Email already registered')
        } else {
            password(req.body.password).hash(async (err, hash) => {
                if (err) throw err
                const newUser = await User.create({
                    ...req.body,
                    password: hash,
                    registeredAt: new Date()
                })
                res.json(newUser)
            })
        }
    } catch (err) {
        throw err
    }
})

app.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
        if (user) {
            res.json(user)
        } else {
            res.status(404)
            res.json('User not found')
        }
    } catch (err) {
        throw err
    }
})

app.get('/users/:id/conversations', async (req, res) => {
    try {
        const response = await elasticClient.search({
            index: 'conversations',
            type: 'conversation',
            body: {
                query: {
                    multi_match: {
                        query: req.params.id,
                        fields: [ 'author', 'recipient' ]
                    }
                },
                sort: { createdAt: { order: 'desc' } }
            }
        })
        const normalizedResponse = normalize(response.hits.hits)
        let conversations = await Promise.all(normalizedResponse.map(async (conversation) => {
            conversation.recipient = await User.findById(conversation.recipient)
            conversation.author = await User.findById(conversation.author)
            const response = await elasticClient.search({
                index: 'messages',
                type: 'message',
                body: {
                    query: {
                        bool: {
                            must: {
                                match: { conversation: conversation.id }
                            }
                        }
                    },
                    from: 0,
                    size: 100,
                    sort: { sentAt: { order: 'desc' } }
                }
            })
            conversation.lastMessage = normalize(response.hits.hits[0])
            return conversation
        }))
        conversations = sort(conversations).desc(conversation => conversation.lastMessage.sentAt)
        res.json(conversations)
    } catch (err) {
        throw err
    }
})

app.get('/conversations/:author/:recipient', async (req, res) => {
    try {
        let response = await elasticClient.search({
            index: 'conversations',
            type: 'conversation',
            body: {
                query: {
                    bool: {
                        must: [
                            { multi_match: {
                                query: req.params.author,
                                fields: [ 'author', 'recipient' ]
                            } },
                            { multi_match: {
                                query: req.params.recipient,
                                fields: [ 'author', 'recipient' ]
                            } }
                        ]
                    }
                }
            }
        })
        let conversation = { messages: [] }
        if (response.hits.hits.length) {
            conversation = normalize(response.hits.hits[0])
            response = await elasticClient.search({
                index: 'messages',
                type: 'message',
                body: {
                    query: {
                        bool: {
                            must: {
                                match: { conversation: conversation.id }
                            }
                        }
                    },
                    from: 0,
                    size: 100,
                    sort: { sentAt: { order: 'asc' } }
                }
            })
            conversation.messages = normalize(response.hits.hits)
        }
        conversation.recipient = await User.findById(conversation.recipient ? conversation.recipient : req.params.recipient)
        conversation.author = await User.findById(conversation.author ? conversation.author : req.params.author)
        res.json(conversation)
    } catch (err) {
        throw err
    }
})

server.listen(3030)