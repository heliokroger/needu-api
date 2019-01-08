import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'
import cloudinary from 'cloudinary'
import http from 'http'
import socket from './socket'
import authentication from './routers/authentication'
import conversations from './routers/conversations'
import people from './routers/people'
import users from './routers/users'

mongoose.connect('mongodb://localhost:27017/needu', { useNewUrlParser: true })

cloudinary.config({
    cloud_name: 'needu',
    api_key: '148252288734481',
    api_secret: '0V2qn8wdM5TAj-_2sNmmw4_1WLk'
})

const app = express()

const server = http.Server(app)

socket(server)

app.use(bodyParser.json({ limit: '30MB' }))
app.use(cors())

app.use('/authentication', authentication)
app.use('/conversations', conversations)
app.use('/people', people)
app.use('/users', users)

server.listen(3030)