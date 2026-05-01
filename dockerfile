# Используем легковесную версию Node.js
FROM node:18-alpine

# Создаем папку приложения внутри контейнера
WORKDIR /app

# Копируем файл package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем весь остальной код (сервер)
COPY . .

# Открываем порт
EXPOSE 3000

# Запускаем сервер
CMD ["npm", "start"]
