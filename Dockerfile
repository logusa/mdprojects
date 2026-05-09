# Etapa de construcción
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa de producción (Servidor Web Nginx)
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Configuración para que el enrutamiento de la SPA funcione
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]