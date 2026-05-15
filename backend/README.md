Файл будет обновляться.

На данный момент для запуска необходимо:
 - Docker version 29.3.1
 - Docker Compose version 5.1.0
 - Go version 1.25.5
 - golang-migrate 4.19.1 https://github.com/golang-migrate/migrate
 - make version 3.81

Команды для запуска программы через терминал (порядок соблюден):

 - docker compose up -d # запуск контейнера с бд
 - make migrate-up # применение миграций
 - make run # запуск приложения


доступные endpoints на данный момент:
 - GET /health 
 - GET /user # Получить пользователя
 - POST /inbox # Создать элемент inbox
 - GET /inbox?status=new&limit=10&offset=0 # status - фильтр по статусу, limit - кол-во элементов, offset - смещение
 - DELETE /inbox/{id} # Удалить элемент inbox
 - POST /inbox/{id}/skip # Переместить элемент в конец очереди
    

 - BASE URL: localhost:8080


