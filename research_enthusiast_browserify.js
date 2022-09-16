const user = {}
const day = 60 * 60 * 24
const ProjectName = "🔬Research enthusiast"
const Version = "v1.3.1"
const host = "https://www.sekahui.com"
const ordersLink = "https://www.sekahui.com/wap/my_room_yuyue_dian_quanbu.php?r=317340"
const postUrl = "https://www.sekahui.com/wap/room_yuyue_quanbu.php?mendianbianhao=317340"
const queryUrl = `https://www.sekahui.com/wap/mendian_yuyue_quanbu.php?mendian_id=317340&day=`

const _request = (url, method, data = null) => {
    const r = (resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                const ret = {
                    body: xhr.responseText,
                    code: xhr.status,
                }
                xhr.status === 200 || xhr.status === 302 ? resolve(ret) : reject(ret)
            }
        }
        xhr.open(method, url)
        xhr.send(data)
    }
    return new Promise(r)
}

const get = url => _request(url, "GET")

const post = (url, data = null) => _request(url, "POST", data)

const getTimestampMs = date => Date.parse(`${date || user.date} 00:00:00`)

const getTimestamp = date => getTimestampMs(date) / 1000

const getQueryUrl = date => queryUrl + getTimestamp(date)

const getHtml = async date => {
    try {
        const {body} = await get(getQueryUrl(date));
        return body
    } catch (e) {
        console.log("get html failed")
        throw e
    }
}

const domFromNetWork = async () => {
    const html = await getHtml()
    return new DOMParser().parseFromString(html, "text/html")
}

const parseNodes = async () => {
    console.log("parsing data ...")
    const _document = await domFromNetWork()
    const formDl = getFormData(_document)
    const labelNodes = _document.querySelector("#frm > div.box > div > table:nth-child(1) > tbody > tr")
    const labels = [...labelNodes.getElementsByTagName("td")].map(n => n.textContent.trim())
    const inputNodes = _document.querySelector("#frm > div.box > div > table:nth-child(2) > tbody > tr")
    const tds = [...inputNodes.getElementsByTagName("td")]
    const options = {}
    tds.forEach((td, index) =>
        [...td.getElementsByTagName("input")].forEach(i => {
            const o = {
                "id": i.getAttribute("id"),
                "name": i.getAttribute("name"),
                "value": i.getAttribute("value"),
                "label": labels[index]
            }
            const key = o.label
            options[key] = options[key] || []
            options[key].push(o)
        })
    )
    user.labels = labels
    return {formDl, options}
}

const _choose = (options, target) => {
    if (!user.labels) throw "labels not found"
    if (!user.labels.includes(target)) throw `invalid label ${target}, choose from ${user.labels}`

    const tList = options[target] || []
    const r = user.durations.map(d => tList.find(t => t.value.endsWith(d)))
    const res = r.filter(r => r).map(c => [c.name, c.value])
    if (!res || res.length !== user.durations.length) {
        console.log(`expect length ${user.durations.length}, ${res?.length} got, ${target} ignore`)
        console.log(options)
        throw `${target} ${user?.durations?.join(",")} has been occupied or suspended`
    }
    return res
}

const choose = options => user.targets.map(t => _choose(options, t)).filter(r => r)

const order = async payload => {
    const start = new Date()
    console.log(`ordering ... ${start}`)
    const {body, code} = await post(postUrl, payload)
    if (code === 200 && body.includes("预约成功")) {
        onSuccess(start, body)
        return true
    }
    console.log("failed ", code, body, new Date())
    return false
}

const onSuccess = (start, text) => {
    const now = new Date()
    const cost = now.getTime() - start
    console.log(`Done! order time: ${start.toLocaleString()} - ${now.toLocaleString()}, cost ${Math.floor(cost / 1000)}s ${cost % 1000}ms`)
    if (user.running) {
        return self?.postMessage(text)
    }
    const page = new DOMParser().parseFromString(text, "text/html")
    console.log("Order info: ", page.querySelector("div > br").parentElement.textContent)
}

const waitUntilStartTime = date => {
    const ms = getTimestampMs(date)
    return waitUntil(ms - (day * 1000))
}

const waitUntil = async timestamp => {
    let remain = timestamp - Date.now()
    if (remain <= 0) return
    console.log(`call function stopTimer to cancel`)
    while (remain > 0) {
        if (user.stop) {
            user.stop = false
            user.running = false
            throw "user canceled"
        }
        const st = getSleepTime(remain)
        const h = Math.floor(remain / 1000 / 3600), m = Math.floor(remain / 1000 % 3600 / 60),
            s = Math.floor(remain / 1000 % 60)
        console.log("countdown ", h, "h ", m, "m ", s, " s  - ", Math.floor(st / 1000), " s ", new Date())
        await sleep(st)
        remain = timestamp - Date.now()
    }
}

const getSleepTime = remain => {
    const second = 1000
    const minute = 60 * second
    const minWait = 5 * second
    return remain > (minute + 25 * second) ? minute : remain > minWait ? minWait : (remain + second / 10)
}

const stopTimer = () => {
    user.stop = true
    stopWorkerTimer()
}

const getFormData = dom => [...Array(7).keys()].map(i => {
    const element = dom.querySelector(`#frm > input[type=hidden]:nth-child(${i + 1})`)
    return [element.getAttribute("name"), element.getAttribute("value")]
})

const buildFormByList = dl => {
    const formData = new FormData()
    dl.forEach(d => {
        let [name, value] = d
        value = name === "create_time" ? normalizeCreatedTime(value) : value
        formData.append(name, value)
    })
    formData.append("beizhu", "")
    return formData
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const normalizeCreatedTime = t => {
    const remain = getTimestamp() - day - parseInt(t)
    return remain >= 0 ? (getTimestamp() - day + getRndInteger(1,2)).toString() : t
}

function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1) ) + min;
}

const run = async () => {
    tip(user)
    const {formDl, options} = await parseNodes()
    const candidates = choose(options)
    for (const c of candidates) {
        const payload = buildFormByList(formDl.concat(c))
        await waitUntilStartTime()
        const result = await order(payload)
        if (result) return 0
    }
    throw "all tasks failed"
}

const configUser = config => {
    formatConfig(config)
    validConfig(config)
    Object.entries(config).forEach(([k, v]) => {
        user[k] = v
    })
}

const str2sequence = d => {
    console.assert(d.includes("-"))
    const [start, end] = d.split("-")
    console.assert(start.includes(":") && end.includes(":"))
    const [startHour, startMin] = start.split(":").map(n => parseInt(n.trim()))
    const [endHour, endMin] = end.split(":").map(n => parseInt(n))
    console.assert(endHour >= startHour && startHour >= 7 && endHour <= 22)
    const durations = []
    for (let i = startHour; i < endHour; i++) {
        (i !== startHour || startMin !== 30) && durations.push(`${i}:00`)
        durations.push(`${i}:30`)
    }
    endMin === 30 && durations.push(`${endHour}:00`)
    return durations
}

const formatConfig = config => {
    if (typeof (config.targets) === "string") {
        config.targets = [config.targets]
    }

    if (typeof (config.durations) === "string") {
        config.durations = str2sequence(config.durations)
    } else if (Array.isArray(config.durations) && config.durations.length === 1 && config.durations[0].includes("-")) {
        config.durations = str2sequence(config.durations[0])
    }
}

const validConfig = config => {
    try {
        _valid(config)
    } catch (e) {
        usage()
        throw e
    }
}

const _valid = config => {
    if (!config) throw "config is required"
    if (!config.date) throw "config.targets is required"
    if (!config.targets) throw "config.targets is required"
    if (!config.durations) throw "config.durations is required"
    if (typeof (config.date) !== "string") throw "config.date must be string,eg: 2022-05-07"
    if (!Array.isArray(config.targets)) throw "config.targets must be array"
    if (!Array.isArray(config.durations)) throw "config.durations must be array with duration start time"
}


const usage = () => {
    const msg = `//${ProjectName} ${Version} usage:\n` +
        'const config = {\n' +
        '    date: "2022-05-09",\n' +
        '    targets: "细胞室一 生物安全柜",\n' +
        '    durations: "15:00-20:00",\n' +
        '}\n' +
        'runWithConfig(config).then(r => console.log("exit with code " + r))'
    console.log(msg)
}

const tip = u => console.log(`${user.date} ${Array.isArray(u.targets) ? u.targets.join(" || ") : u.targets} -> ${u.durations}`)

const runWithConfig = config => {
    configUser(config)
    return run()
}

const stopWorkerTimer = () => {
    user?.worker?.postMessage("stop")
    user?.worker?.terminate()
    user?.worker && console.log("worker terminated")
    user.worker = undefined
}

const createWorker = () => {
    const b = new Blob([`${workerText}`])
    const wk = new Worker(window.URL.createObjectURL(b))
    wk.onmessage = ({data}) => {
        if (data === "terminate") {
            console.log("exit with code 0")
            return stopWorkerTimer()
        } else {
            try {
                const page = new DOMParser().parseFromString(data, "text/html")
                console.log("Order info: ", page.querySelector("div > br").parentElement.textContent)
            } catch (e) {
                console.log("unknown message", e, data)
            }

        }
    }
    return wk
}


const runOnWorker = async () => {
    tip(user)
    const {formDl, options} = await parseNodes()
    const candidates = choose(options).map(c => [...buildFormByList(formDl.concat(c)).entries()])
    if (!candidates?.length){
        throw "config error,no plan found"
    }
    stopWorkerTimer()
    const wk = createWorker()
    user.worker = wk
    wk.postMessage(JSON.stringify({candidates, user}))
}

const workerText = `
const runOrder = async candidates => {
    await waitUntilStartTime()
    for (const c of candidates) {
        const result = await order(c)
        if (result) return 0
    }
    throw "all tasks failed"
}

const order = async payload => {
    const start = new Date()
    console.log("ordering ... ", start)
    const {body, code} = await post(postUrl, payload)
    if (code === 200 && body.includes("预约成功")) {
        onSuccess(start, body)
        return true
    }
    console.log("failed ", code, body, new Date())
    return false
}

const onSuccess = (start, text) => {
    const now = new Date()
    const cost = now.getTime() - start
    console.log("Done! order time: ", start.toLocaleString(), "-", now.toLocaleString(), " cost ", Math.floor(cost / 1000), "s ", cost % 1000, "ms")
    if (user.running) {
        return self?.postMessage(text)
    }
    const page = new DOMParser().parseFromString(text, "text/html")
    console.log("Order info: ", page.querySelector("div > br").parentElement.textContent)
}

const decode = ars => ars.map(ar => {
    const d = new FormData()
    ar.forEach(a => d.append(...a))
    return d
})

onmessage = ({data}) => {
    try {
        data = JSON.parse(data)
    }catch (e) {}

    if (data?.candidates) {
        if (user.running) {
            console.log("wait stop ...")
            return stopTimer()
        }
        if (!data.user) {
            return console.log("no user post")
        }

        Object.entries(data.user).forEach(([k, v]) => {
            user[k] = v
        })
        user.running = true
        runOrder(decode(data.candidates)).then(r => {
            user.running = false
            self?.postMessage("terminate")
        })
    } else if (data === "stop") {
        return stopTimer()
    } else {
        console.log("unknown message type:", data)
    }
}

const waitUntilStartTime = date => {
    const ms = getTimestampMs(date)
    return waitUntil(ms - (day * 1000))
}

const waitUntil = async timestamp => {
    let remain = timestamp - Date.now()
    if (remain <= 0) return
    console.log("call function stopTimer to cancel")
    while (remain > 0) {
        if (user.stop) {
            user.stop = false
            user.running = false
            throw "user canceled"
        }
        const st = getSleepTime(remain)
        const h = Math.floor(remain / 1000 / 3600), m = Math.floor(remain / 1000 % 3600 / 60),
            s = Math.floor(remain / 1000 % 60)
        console.log("countdown ", h,"h ", m, "m ", s, "s  - ", Math.floor(st / 1000), "s ", new Date())
        await sleep(st)
        remain = timestamp - Date.now()
    }
}

const getSleepTime = remain => {
    const second = 1000
    const minute = 60 * second
    const minWait = 5 * second
    return remain > (minute + 25 * second) ? minute : remain > minWait ? minWait : (remain + second / 10)
}

const day = 60 * 60 * 24

const getTimestampMs = date => Date.parse((date || user.date) +" 00:00:00")

const sleep = ms => new Promise(r => setTimeout(r, ms));

const _request = (url, method, data = null) => {
    const r = (resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                const ret = {
                    body: xhr.responseText,
                    code: xhr.status,
                }
                xhr.status === 200 || xhr.status === 302 ? resolve(ret) : reject(ret)
            }
        }
        xhr.open(method, url)
        xhr.send(data)
    }
    return new Promise(r)
}

const post = (url, data = null) => _request(url, "POST", data)

const postUrl = "https://www.sekahui.com/wap/room_yuyue_quanbu.php?mendianbianhao=317340"

const user = {}`

const runWithConfigOnWorker = config => {
    configUser(config)
    return runOnWorker()
}

const modifyOrder = async cfg => {
    formatConfig(cfg)
    const currentOrder = await findOrderByConfig(cfg)
    configUser(cfg)
    tip(user)
    user.date = getAvailableDay()
    const {formDl, options} = await parseNodes()
    const [candidate] = choose(options).filter(r => r)
    if (!candidate) throw `build form error,user ${user}`
    user.date = cfg.date
    const payload = buildFormByList(formDl.concat(candidate))
    payload.set("create_time", `${Math.floor(Date.now() / 1000)}`)
    payload.set("yuding_ri", getTimestamp(cfg.date).toString())
    await waitUntilStartTime(cfg.date)
    await cancelOrder(currentOrder)
    await sleep(500)
    return await order(payload)
}

const getAvailableDay = () => {
    const d = new Date(Date.now() + 2 * day * 1000)
    d.setHours(0, 0, 0, 0)
    return d.toLocaleDateString()
}

const getOrders = async () => {
    const {body} = await get(ordersLink)
    const doc = new DOMParser().parseFromString(body, "text/html")
    return [...doc.querySelectorAll("table")].map(parseOrder).filter(r => r)
}

const parseOrder = table => {
    const texts = table.parentElement.parentElement.textContent.trim().split("\n").filter(r => r.trim()).map(r => r.trim())
    const date = /预约日期：(\d{2})月(\d{2})日/gm.exec(texts[1] || "");
    if (!date) return null
    const {"1": month, "2": day} = date
    const regex = /(\d{1,2}:\d{2})-/gm;
    const order = {durations: []}
    for (const t of texts[2].matchAll(regex)) {
        order.durations.push(t["1"])
    }
    order.date = `${new Date().getFullYear()}-${month}-${day}`
    order.targets = texts.slice(0, 1)
    order.link = table.querySelector("a").getAttribute("href")
    return order
}

const findOrderByConfig = async cfg => {
    const orders = await getOrders()
    const order = orders.find(order => order.targets.join() === cfg.targets.join() && order.date === cfg.date)
    if (order) {
        if (!order.durations.sort().join().includes(cfg.durations.sort().join())) throw `${cfg.durations} not found in ${order.durations}`
        return order
    }
    throw `cfg not found in orders ${orders}`
}

const cancelOrder = order => get(`${host}${order.link}`)

const onload = () => console.log(
    `%c ${ProjectName} %c ${Version} `,
    'padding: 2px 1px; border-radius: 3px 0 0 3px; color: #fff; background: #FF6132; font-weight: bold;',
    'padding: 2px 1px; border-radius: 0 3px 3px 0; color: #fff; background: #42c02e; font-weight: bold;',
);

const feature = () => console.log("1. fix created time")

onload()