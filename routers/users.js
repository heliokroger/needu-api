import { Router } from 'express'
import sort from 'fast-sort'
import User from '../models/User'
import elasticClient from '../elasticClient'
import { normalize } from '../helpers'

const router = new Router()

router.get('/:id', async (req, res) => {
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

router.get('/:id/conversations', async (req, res) => {
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

export default router