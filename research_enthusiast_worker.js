onmessage = ({data}) => {
    if (data?.date) {
        if (user.running) {
            console.log("wait stop ...")
            return stopTimer()
        }
        user.running = true
        runWithConfig(data).then(r => {
            console.log("exit with code " + r)
            user.running = false
        })
    } else if (data === "stop") {
        console.log("canceling ...")
        return stopTimer()
    } else {
        console.log("unknown message type:", data)
    }
}