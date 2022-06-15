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

---
&copy; kokutele project, 2022.
