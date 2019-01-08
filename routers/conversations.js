import { Router } from 'express'
import User from '../models/User'
import elasticClient from '../elasticClient'
import { normalize } from '../helpers'

const router = new Router()

router.get('/:author/:recipient', async (req, res) => {
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

export default router