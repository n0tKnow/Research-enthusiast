const jsdom = require("jsdom");
const {JSDOM} = jsdom;
const FormData = require('form-data');
const {request} = require('https')


const user = {
    "uname": "",
    "pwd": "",
    "date": "2021-05-08",
    targets: ["xxx"],
    durations: ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30"],
}


const doRequest = (url, headers, method, data) => {
    const r = (resolve, reject) => {
        const option = {
            method,
            headers
        }
        const req = request(url, option, res => {
            res.setEncoding('utf8');

            let body = '';

            res.on('data', function (chunk) {
                body = body + chunk;
            });

            res.on('end', function () {
                if (res.statusCode === 200 || res.statusCode === 302) {
                    resolve({body, code: res.statusCode, headers: res.headers})
                } else {
                    reject({body, code: res.statusCode})
                }
            });
        })

        req.on('error', function (e) {
            console.log("Error : " + e.message);
            reject(e);
        });

        // write data to request body
        data && req.write(data);
        req.end();
    }

    return new Promise(r)
}

const get = (url, headers) => doRequest(url, headers, "GET")

const post = (url, headers, data) => doRequest(url, headers, "POST", data)

const getTimestampMs = date => Date.parse(`${date || user.date} 00:00:00`)

const getTimestamp = () => getTimestampMs() / 1000

const postUrl = "https://www.sekahui.com/wap/room_yuyue_quanbu.php?mendianbianhao=317340"
const queryUrl = `https://www.sekahui.com/wap/mendian_yuyue_quanbu.php?mendian_id=317340&fenlei=%E7%BB%86%E8%83%9E%E5%9F%B9%E5%85%BB%E5%B9%B3%E5%8F%B0&day=`

const getBaseHeader = () => {
    const h = {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
        "origin": "https://www.sekahui.com"
    }
    user["cookie"] && (h["cookie"] = user["cookie"])
    return h
}


const getQueryUrl = date => queryUrl + getTimestamp()

const getHtml = async date => {
    const data = await get(getQueryUrl(), getBaseHeader());
    const {body, code} = data
    if (code !== 200) throw "get html error code:" + code + body
    return body
}

const domFromFile = () => JSDOM.fromFile("response.html")
const domFromNetWork = async () => {
    const html = await getHtml()
    return new JSDOM(html)
}


const parse = async () => {
    const dom = await domFromNetWork()
    const _document = dom.window.document
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

const login = () => {
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


const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array
}

const order = async payload => {
    const data = await post(postUrl, {
        ...getBaseHeader(),
        "content-type": `multipart/form-data; boundary=${payload.getBoundary()}`,
    }, payload.getBuffer().toString())
    const {body, code, headers} = data
    const link = headers.location

    if (code === 302 && link.includes("chenggong")) {
        console.log("Done! " + link)
        return true
    }
    console.log("failed ", code, body, link)
    return false
}

const getBoundary = () => {
    return "------WebKitFormBoundaryJ5B3GLbkIOqiyUFG"
}


const day = 60 * 60 * 24
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

const getFormData = dom => [...Array(7).keys()].map(i => {
    const element = dom.querySelector(`#frm > input[type=hidden]:nth-child(${i + 1})`)
    return [element.getAttribute("name"), element.getAttribute("value")]
})

const buildFormByList = dl => {
    const formData = new FormData()
    formData.setBoundary(getBoundary())
    dl.forEach(d => {
        let [name, value] = d
        value = name === "create_time" ? handleCreatedTime(value) : value
        formData.append(name, value)
    })
    formData.append("beizhu", "")
    return formData
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const handleCreatedTime = t => {
    const remain = getTimestamp() - day - parseInt(t)
    console.log("remain", remain)
    return remain >= 0 ? (getTimestamp() + 1).toString() : t
}

const run = async () => {
    const {formDl, options} = await parse()
    const candidates = choose(options)
    //console.log(formDl, c)
    for (const c of candidates) {
        const payload = buildFormByList(formDl.concat(c))
        await waitUntilStartTime()
        console.log(payload.getBuffer().toString())
        const result = await order(payload)
        if (result) return
    }
    throw "no one success"
}

console.log("start")
run().then(r => console.log("exit with " + r))