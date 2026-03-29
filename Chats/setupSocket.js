const { Server } = require('socket.io')

function setupSocket(server) {
    const io = new Server(server, {
        cors: { origin: '*' },
        path: '/socket.io'
    })
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id)

        socket.on('message:send', (data) => {
            io.emit('message:new', {
                ...data,
                id: Date.now(),
                sent_at: new Date()
            })
        })

        socket.on('disconnect', () => {
            console.log('User disconnected')
        })
    })
    return io
}

module.exports = setupSocket