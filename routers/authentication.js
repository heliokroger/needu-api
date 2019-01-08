import { Router } from 'express'
import password from 'password-hash-and-salt'
import User from '../models/User'

const router = new Router()

router.post('/facebook', async (req, res) => {
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

router.post('/login', async (req, res) => {
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

router.post('/register', async (req, res) => {
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

export default router