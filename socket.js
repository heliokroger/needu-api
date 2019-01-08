import Socket from 'socket.io'
import onMessage from './socket-events/message'

export default server => {
    const io = new Socket(server)

    let users = []

    io.on('connection', socket => {
        users.push({ id: socket.handshake.query.user, socket: socket.id })

        socket.on('message', async data => {
            const message = await onMessage(data)
            const author = users.find(user => user.id === data.author)
            const recipient = users.find(user => user.id === data.recipient)
            if (author) io.to(author.socket).emit('message', message)
            if (recipient) io.to(recipient.socket).emit('message', message)
        })

        socket.on('disconnect', () => {
            users = users.map(user => user.socket !== socket.id)
        })
    })
}