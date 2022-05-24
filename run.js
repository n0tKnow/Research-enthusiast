$.globalEval(await (await fetch("https://raw.githubusercontent.com/n0tKnow/Research-enthusiast/master/research_enthusiast_browserify.js")).text())

const config = {
    date: "2022-05-26",
    targets: "荧光定量PCR仪",
    durations: "8:00-11:30",
}
runWithConfigOnWorker(config)