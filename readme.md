# kokutele-studio

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

## build

for production, you need to build webapp as shown below

* build webapp

```
$ npm run build
```

* start server

```
$ npm run start.production
```

then open `http://localhost:4443`

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


## docker

* build

```
$ npm run build.docker
```

* run

please note that docker `kokutele-studio` MUST be run on linux. ( since it requires `--net=host` option )

```
$ docker run --net=host -e MEDIASOUP_LISTEN_IP=YOUR_SERVER_ADDRESS -e MEDIASOUP_ANNOUNCED_IP=YOUR_EXTERNAL_IP -v /var/lib/kokutele-studio:/var/lib/kokutele-studio kokutele-studio
```

---
&copy; kokutele project, 2022.
