# kokutele-studio

## How to run

### build

```
$ npm run build.docker
```

container `kokutele-studio` will be built.

### run

#### pattern 1 : orchestrate with turn server

kokutele-studio is leveraging [mediasoup](https://mediasoup.org/) for WebRTC-SFU feature. Since mediasoup supports [ice-lite](https://bloggeek.me/webrtcglossary/ice-lite/) only, this system needs to expose wide range of udp which is low affinity for container based system, such as kubernetes. Also, it brings less reachability especially in enterprise case.

This deployment pattern, using docker-compose, turn server which relays WebRTC traffic between client and kokutele-studio is used to avoid exposing wide range of UDP ports. This approach needs few dedicated port only ( our configuration is 80 for udp and tcp ).

```
$ cd deploy
$ docker-compose up
```

Then, access to http://localhost:4443

Please be note that you may need to update `turnserver.conf` along with your environment.

#### pattern 2 : single container

If you do not want to use turn server for kokutele-studio. You can run it in single container with docker. Since, as written before, mediasoup requires wide range of udp port exposing, you need to set `--net=host` as an option of `docker run` as shown below. Please be care that `--net=host` only work on Linux.

```
$ docker run --net=host -e MEDIASOUP_LISTEN_IP=YOUR_SERVER_ADDRESS -e MEDIASOUP_ANNOUNCED_IP=YOUR_EXTERNAL_IP -v /var/lib/kokutele-studio:/var/lib/kokutele-studio kokutele-studio
```

Then, access to http://localhost:4443


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

---
&copy; kokutele project, 2022.
