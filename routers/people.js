import { Router } from 'express'
import User from '../models/User'
import elasticClient from '../elasticClient'
import { normalize, cloudinaryUpload } from '../helpers'

const router = new Router()

router.get('/:lat,:lon', async (req, res) => {
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
        res.json(people)
    } catch (err) {
        throw err
    }
})

router.get('/:lat,:lon/:filters', async (req, res) => {
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

router.get('/:id', async (req, res) => {
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

router.post('/', async (req, res) => {
    try {
        const photos = await (async () => {
            return new Promise(async (resolve, reject) => {
                const newPhotos = await Promise.all(photos.map(async photo => {
                    const result = await cloudinaryUpload(photo)
                    return result.secure_url
                }))
                resolve(newPhotos)
            })
        })()
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

export default router