# kokutele-studio

## How to run

### build

```
$ npm run build.docker
```

container `kokutele-studio` will be built.

### run

```
$ cd deploy
$ docker-compose up
```

Then, access to http://localhost:4443

Please be note that you may need to update `turnserver.conf` and `docker-compose.yml` along with your environment.

#### deploying in public internet

kokutele-studio does not have tls features. So, you need to setup https/wss proxy, such as nginx, in front of kokutele-studio.

## dev

for developing, you need to execute both server and webapp independently

* server ( http://localhost:4443 )

```
$ npm start
```

* webapp ( http://localhost:3000 )

```
$ cd webapp
$ npm start
```

# api

## set passcode for specific virtual-studio

```
path: /api/studio/:roomName
method: PUT
headers:
- Content-Type: application/json
body-parameter:
  format: json
  params:
    property: passcode
    type: text

example

curl -X PUT -H 'Content-Type:application/json' http://localhost:4443/api/studio/foo -d '{"passcode":"bar"}'
```

# prometheus interface

Kokutele-Studio supports prometheus client interface, which is running on port 4000.
Inaddition to `collectDefaultMetrics` which are provided by [prom-client](https://github.com/siimon/prom-client).
We support mediasoup metrics shown below as a Gauge colloctor.

```
mediasoup_processes_num,
mediasoup_processes_cpu_usage,
mediasoup_processes_memory_usage,
mediasoup_workers_active_num,
mediasoup_workers_idle_num,
mediasoup_workers_total_num,
mediasoup_routers_num,
mediasoup_producers_num,
mediasoup_consumers_num,
```

# Manual (in Japanese)

* [バーチャルスタジオ “Kokutele-Studio” をオープンソース公開しました](https://medium.com/kokutele/%E3%83%90%E3%83%BC%E3%83%81%E3%83%A3%E3%83%AB%E3%82%B9%E3%82%BF%E3%82%B8%E3%82%AA-kokutele-studio-%E3%82%92%E3%82%AA%E3%83%BC%E3%83%97%E3%83%B3%E3%82%BD%E3%83%BC%E3%82%B9%E5%85%AC%E9%96%8B%E3%81%97%E3%81%BE%E3%81%97%E3%81%9F-9bb40d22687)


---
&copy; kokutele project, 2022.
