const user = {}
const day = 60 * 60 * 24
const postUrl = "https://www.sekahui.com/wap/room_yuyue_quanbu.php?mendianbianhao=317340"
const queryUrl = `https://www.sekahui.com/wap/mendian_yuyue_quanbu.php?mendian_id=317340&fenlei=%E7%BB%86%E8%83%9E%E5%9F%B9%E5%85%BB%E5%B9%B3%E5%8F%B0&day=`

const _request = (url, method, data = null) => {
    const r = (resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                const ret = {
                    body: xhr.responseText,
                    code: xhr.status,
                }
                xhr.status === 200 || xhr.status === 302 ? resolve(ret) : reject(ret)
            }
        };
        xhr.open(method, url);
        xhr.send(data);
    }

    return new Promise(r)
}

const get = url => _request(url, "GET")

const post = (url, data = null) => _request(url, "POST", data)

const getTimestampMs = date => Date.parse(`${date || user.date} 00:00:00`)

const getTimestamp = () => getTimestampMs() / 1000

const getQueryUrl = date => queryUrl + getTimestamp()

const getHtml = async date => {
    const {body, code} = await get(getQueryUrl());
    if (code !== 200) throw "get html error code:" + code + body
    return body
}

const domFromNetWork = async () => {
    const html = await getHtml()
    return new DOMParser().parseFromString(html, "text/html")
}

const parseNodes = async () => {
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
        console.log(`expect length ${user.targets.length}, ${res?.length} got`)
        return null
    }
    return res
}

const choose = options => user.targets.map(t => _choose(options, t)).filter(r => r)

const order = async payload => {
    const {body, code} = await post(postUrl, payload)
    if (code === 200 && body.includes("预约成功")) {
        console.log("Done! ")
        const page = new DOMParser().parseFromString(body, "text/html")
        console.log("Info: ", page.querySelector("div > br").parentElement.textContent)
        return true
    }
    console.log("failed ", code, body)
    return false
}

const waitUntilStartTime = date => {
    const ms = getTimestampMs(date)
    return waitUntil(ms - (day * 1000))
}

const waitUntil = async timestamp => {
    let remain = timestamp - Date.now()
    if (remain <= 0) return
    while (remain > 0) {
        console.log(`countdown ${Math.floor(remain / 1000 / 3600)}h ${Math.floor(remain / 1000 % 3600 / 60)}m ${Math.floor(remain / 1000 % 60)} s`)
        if (user.stop) {
            user.stop = false
            throw "wait canceled"
        }
        await sleep(Math.min(remain, 5000))
        remain = timestamp - Date.now()
    }
    console.log("time confirmed")
}

const stopCountdown = () => {
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
    const {formDl, options} = await parseNodes()
    const candidates = choose(options)
    //console.log(formDl, c)
    for (const c of candidates) {
        const payload = buildFormByList(formDl.concat(c))
        await waitUntilStartTime()
        const result = await order(payload)
        if (result) return 0
    }
    throw "no one success"
}

const configUser = config => {
    validConfig(config)
    Object.entries(config).forEach(([k, v]) => {user[k] = v})
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
    const msg = '//🔬Research enthusiast v1.0.0 usage:\n' +
        'const config = {\n' +
        '    date: "2022-05-07",\n' +
        '    targets: ["细胞室一 3号超净工作台", "细胞室一 1号超净工作台", "细胞一室 2号超净工作台"],\n' +
        '    durations: ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30"],\n' +
        '}\n' +
        'runWithConfig(config).then(r => console.log("exit with code " + r))'
    console.log(msg)
}

const runWithConfig = config => {
    configUser(config)
    return run()
}

const onload = ()=> console.log("🔬Research enthusiast v1.0.0")

onload()