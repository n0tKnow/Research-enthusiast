const [alternateDay] = new Date(new Date().setHours(0, 0, 0, 0) + 2*day*1000).toLocaleString().replaceAll("/","-").split(" ")

const config = {
    date: alternateDay,
    targets: "荧光定量PCR仪",
    durations: "8:00-11:30",
}
runWithConfigOnWorker(config)