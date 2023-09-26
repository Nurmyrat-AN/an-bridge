import http from 'http'
import express from 'express'
import { io } from "socket.io-client"
import fs from 'fs'
import hddserial from 'hddserial'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import JSZip from 'jszip'

const app = express()

type LISTENERS_TYPE = {
    from: string,
    to: string,
    interval: number,
    savecache: boolean
    _sequence_number: number
    cache?: any[]
}
type LOCAL_LISTENER_TYPE = LISTENERS_TYPE & { uid: string }
let _listeners: LOCAL_LISTENER_TYPE[] = []
const configFile = 'app-config.json'

type SETTINGS_TYPE = {
    shop: string,
    app: string,
    server: string,
}

const getSettings = () => new Promise((resolve, reject) => {
    const _default = {
        shop: 'atom',
        app: 'aish-bridge',
        server: 'https://api.atom.com.tm',
    }
    fs.readFile(configFile, {}, (err, data) => {
        if (err) {
            fs.writeFile(configFile, JSON.stringify(_default), (err) => {
                resolve(_default)
            })
        } else {
            resolve(JSON.parse(data.toString()))
        }
    })

})

const getUID = () => new Promise((resolve, reject) => hddserial.one(0, (err, v) => resolve(v || 'not found ID')))


const startServer = async () => {
    const settings: SETTINGS_TYPE = await getSettings() as SETTINGS_TYPE

    //@ts-ignore
    const device_id = await getUID()

    //@ts-ignore
    let socket = io(settings.server, {
        auth: {
            //@ts-ignore
            shop: settings.shop,
            //@ts-ignore
            app: settings.app,
            //@ts-ignore
            device_id
        }
    })
    socket.connect()


    socket.on('bridge-listeners', (listeners: LISTENERS_TYPE[]) => {
        _listeners = listeners.map(listener => ({
            ...listener,
            uid: `${socket.id}-${uuidv4()}`,
        }))
        _listeners.forEach((listener, index) => {
            const request = async () => {
                try {
                    const aish_result = await axios.get(`${listener.from}?limit=100&since=${listener._sequence_number}`, { responseType: 'json' })
                    let data = aish_result.data

                    if (listener.savecache) {
                        if (!listener.cache) {
                            listener.cache = [...data]
                        } else {
                            const filtered = data.filter((item: any) => !Boolean((listener.cache || []).find(lc => JSON.stringify(lc) === JSON.stringify(item))))
                            if (filtered.length < data.length) {
                                listener.cache = [...data]
                                data = filtered
                            }
                        }
                    }


                    if (data.length === 0) throw 'No data'
                    var zip = new JSZip()
                    zip.file('data', JSON.stringify(data))
                    const content = (await zip.generateAsync({
                        type: "uint8array",
                        compression: "DEFLATE"
                    })).toString()
                    const result = await axios.post(`${settings.server}${listener.to}`, { content }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/multipart-data'
                        },
                        responseType: 'json'
                    })
                    listener._sequence_number = result.data._sequence_number
                } catch (e) {
                    console.log(e)
                }

                if (_listeners.find(l => l.uid === listener.uid)) {
                    setTimeout(request, listener.interval)
                }
            }
            setTimeout(request, 500 * index)
        })
    })

    socket.on('reconnect', () => {
        socket.disconnect()
        socket.connect()
    })

    socket.on('connect', () => {
        console.log('connected')
        axios.defaults.headers.common = {
            device_id: socket.id
        }
    })

    socket.on('disconnect', () => {
        console.log('Disconnected')
        _listeners = []
    })
    const server = http.createServer(app)

    const port = 3001

    server.listen(port, () => console.log(`Node app is running on port ${port}`))

    server.on('uncaughtException', (err) => console.log('something terrible happened..', err))
}

startServer()
