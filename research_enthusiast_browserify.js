const user = {}
const day = 60 * 60 * 24
const VERSION = "🔬Research enthusiast v1.0.0"
const postUrl = "https://www.sekahui.com/wap/room_yuyue_quanbu.php?mendianbianhao=317340"
const queryUrl = `https://www.sekahui.com/wap/mendian_yuyue_quanbu.php?mendian_id=317340&fenlei=%E7%BB%86%E8%83%9E%E5%9F%B9%E5%85%BB%E5%B9%B3%E5%8F%B0&day=`

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
    //const times = tds[0].getElementsByTagName("div").map(div => div.textContent.trim())
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
    return {formDl, options}
}

const _choose = (options, target) => {
    const tList = options[target] || []
    const r = user.durations.map(d => tList.find(t => t.value.endsWith(d)))
    const res = r.filter(r => r).map(c => [c.name, c.value])
    if (!res || res.length !== user.durations.length) {
        console.log(`expect length ${user.targets.length}, ${res?.length} got, ${target} ignore`)
        return null
    }
    return res
}

const choose = options => user.targets.map(t => _choose(options, t)).filter(r => r)

const order = async payload => {
    const start = new Date()
    const {body, code} = await post(postUrl, payload)
    if (code === 200 && body.includes("预约成功")) {
        onSuccess(start, body)
        return true
    }
    console.log("failed ", code, body)
    return false
}

const onSuccess = (start, text) => {
    const now = new Date()
    const cost = now.getTime() - start
    console.log(`Done! order time: ${start.toLocaleString()} - ${now.toLocaleString()}, cost ${Math.floor(cost / 1000)}s ${cost % 1000}ms`)
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
            throw "user canceled"
        }
        console.log(`countdown ${Math.floor(remain / 1000 / 3600)}h ${Math.floor(remain / 1000 % 3600 / 60)}m ${Math.floor(remain / 1000 % 60)} s`)
        await sleep(getSleepTime(remain))
        remain = timestamp - Date.now()
    }
}

const getSleepTime = remain => {
    const second = 1000
    const minute = 60 * second
    return remain > minute ? minute : remain > 30 * second ? 30 * second : remain > 10 * second ? 10 * second : remain + (second / 10)
}

const stopTimer = () => {
    user.stop = true
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
    return remain >= 0 ? (getTimestamp() + 1).toString() : t
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
    const msg = `//${VERSION} usage:\n` +
        'const config = {\n' +
        '    date: "2022-05-09",\n' +
        '    targets: "细胞室一 生物安全柜",\n' +
        '    durations: "15:00-20:00",\n' +
        '}' +
        'runWithConfig(config).then(r => console.log("exit with code " + r))'
    console.log(msg)
}

const tip = u => console.log(`${Array.isArray(u.targets) ? u.targets.join(" || ") : u.targets} -> ${u.durations}`)

const runWithConfig = config => {
    configUser(config)
    return run()
}

const onload = () => console.log(VERSION)

onload()