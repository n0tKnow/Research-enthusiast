const promise = fetch("https://ghproxy.com/https://raw.githubusercontent.com/n0tKnow/Research-enthusiast/master/research_enthusiast_browserify.js")
const [date] = new Date(new Date().setHours(0, 0, 0, 0) + 2*3600*24*1000).toLocaleString().replaceAll("/","-").split(" ")

const config = {
    date,
    targets: "荧光定量PCR仪",
    durations: "8:00-11:30",
}

promise.then(
    response => response.text()
).then(
    code => $.globalEval(code)
).then(
    _ => runWithConfigOnWorker(config)
)

