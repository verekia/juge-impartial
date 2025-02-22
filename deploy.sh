docker buildx build --platform linux/arm64 --load -t verekia/discord-juge .
docker save -o /tmp/discord-juge.tar verekia/discord-juge
scp /tmp/discord-juge.tar midgar:/tmp/
ssh midgar docker load --input /tmp/discord-juge.tar
ssh midgar docker compose up -d discord-juge
