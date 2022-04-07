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

## url parameters

* studioViewer
  - true : only studio viewer will be displayed.

## docker

* build

```
$ npm run build.docker
```

* run

please note that docker `kokutele-studio` MUST be run on linux. ( since it requires `--net=host` option )

```
$ docker run --net=host -e MEDIASOUP_LISTEN_IP=YOUR_SERVER_ADDRESS -e MEDIASOUP_ANNOUNCED_IP=YOUR_EXTERNAL_IP kokutele-studio
```

---
&copy; kokutele project, 2022.
