const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const fileSystem = require("fs");
const geolib = require("geolib");
const _ = require("lodash");
const config = require("./config");
const helper = require('./helper');
const kb = require("./keyboard-buttons.js");
const keyboard = require("./keyboard.js");
const database = require("../database.json");

helper.logStart();

mongoose.Promise = global.Promise;
mongoose.connect(config.DB_URL)
    .then(() => console.log("MongoDB connected..."))
    .catch((error) => {console.log(error)});

require("./models/film.model.js");
require("./models/cinema.model.js");
require("./models/user.model.js");
const Film = mongoose.model("films");
const Cinema = mongoose.model("cinemas");
const User = mongoose.model("users");

// database.films.forEach(f => new Film(f).save().catch(err => console.log(err)));
// database.cinemas.forEach(c => new Cinema(c).save().catch(err => console.log(err)));
// Used to upload to database.json in MongoDB (used only one time)

const ACTION_TYPE = {
    TOGGLE_FAV_FILM: "tff",
    SHOW_CINEMAS: 'sc',
    SHOW_CINEMAS_MAP: "scm",
    SHOW_FILMS: "sf",
};

//===========================================================

const bot = new TelegramBot(config.TOKEN, {
    polling: true,
});

bot.setMyCommands([
    {command: "/start", description: "Начать работу с ботом"},
]);

bot.on("message", (msg) => {
    const chatId = helper.getChatId(msg);
    switch(msg.text) {
        case kb.home.favourite:
            showFavouriteFilms(chatId, msg.from.id);
            break;
        case kb.home.films:
            bot.sendMessage(chatId, "Выберите жанр", {
                reply_markup: {
                    keyboard: keyboard.films,
                    resize_keyboard: true,
                }
            });
            break;
        case kb.film.comedy:
            sendFilmsByQuery(chatId, {type: "comedy"});
            break;
        case kb.film.action:
            sendFilmsByQuery(chatId, {type: "action"});
            break;
        case kb.film.random:
            sendFilmsByQuery(chatId, {});
            break;
        case kb.home.cinemas:
            bot.sendMessage(chatId, `Отправить местоположение`, {
                reply_markup: {
                    keyboard: keyboard.cinemas,
                    resize_keyboard: true,
                },
            });
            break;
        case kb.back:
            bot.sendMessage(chatId, "Что хотите посмотреть?", {
                reply_markup: {
                    keyboard: keyboard.home,
                    resize_keyboard: true,
                }
            });
            break;
    }

    if (msg.location) {
        console.log(msg.location);
        getCinemasInCoord(chatId, msg.location);
    }
});

// bot.on(/\/pay/, msg => {
//     bot.sendInvoice(
//         msg.chat.id,
//         "Your title",
//         "Your discription",
//         "Your payload",
//         "401643678:TEST:207e3d18-af63-4c2f-b7c0-55a6a90115f5",
//         "RUB",
//         "test",
//         [{
//             "label": "Руб",
//             "amount": 9900,
//         }]
//     );
//     bot.answerPreCheckoutQuery(msg.chat.id);
// });


bot.onText(/\/start/, (msg) => {
    const text = `Здравствуйте, ${msg.chat.first_name}\nВыберите команду для начала работы:`;
    bot.sendMessage(helper.getChatId(msg), text, {
        reply_markup: {
            keyboard: keyboard.home,
            resize_keyboard: true,
        }
    });
});

bot.onText(/\/f(.+)/, (msg, [source, match]) => {
    const filmUuid = helper.getItemUuid(source);
    const chatId = helper.getChatId(msg);

    Promise.all([
        Film.findOne({uuid: filmUuid}),
        User.findOne({telegramId: msg.from.id}),
    ]).then(([film, user]) => {

        let isFav = false;

        if (user) {
            isFav = user.films.indexOf(film.uuid) !== -1
        }

        const favText = isFav ? "Удалить из избранного" : "Добавить в избранное";

        const caption = `Название:  ${film.name}\nГод:  ${film.year}\nРейтинг:  ${film.rate}\nДлительность:  ${film.length}\nСтрана:  ${film.country}`;

        bot.sendPhoto(chatId, film.picture, {
            caption: caption,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: favText,
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.TOGGLE_FAV_FILM,
                                filmUuid: film.uuid,
                                isFav: isFav,
                            }),       
                        },
                        {
                            text: "Показать кинотеатры",
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.SHOW_CINEMAS,
                                cinemaUuids: film.cinemas,
                            }),    
                        },

                    ],
                    [
                        {
                            text: `Кинопоиск ${film.name}`,
                            url: film.link,
                        },
                    ],
                ],
            },
        });
    });
});

bot.onText(/\/c(.+)/, (msg, [source, match]) => {
    const cinemaUuid = helper.getItemUuid(source);
    const chatId = helper.getChatId(msg);

    Cinema.findOne({uuid: cinemaUuid}).then(cinema => {
        bot.sendMessage(chatId, `Кинотеатр ${cinema.name}`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: cinema.name,
                            url: cinema.url,
                        },
                        {
                            text: "Показать на карте",
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.SHOW_CINEMAS_MAP,
                                lat: cinema.location.latitude,
                                lon: cinema.location.longitude,
                            }),
                        },
                    ],
                    [
                        {
                            text: "Показать фильмы",
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.SHOW_FILMS,
                                filmUuids: cinema.films,
                            }),
                        },
                    ],
                ],
            },
        });
    });
});

bot.on("callback_query", (query) => {
    const userId = query.from.id;
    let data;
    try {
        data = JSON.parse(query.data);
    } catch(error) {
        throw new Error("Data is not ab object");
    }
    switch(data.type) {
        case ACTION_TYPE.SHOW_CINEMAS_MAP:
            const {lat, lon} = data;
            bot.sendLocation(query.message.chat.id, lat, lon);
            break;
        case ACTION_TYPE.SHOW_CINEMAS:
            sendCinemasByQuery(userId, {uuid: {"$in": data.cinemaUuids}});
            break;
        case ACTION_TYPE.TOGGLE_FAV_FILM:
            toggleFavouriteFilm(userId, query.id, data);
            break;
        case ACTION_TYPE.SHOW_FILMS:
            sendFilmsByQuery(userId, {uuid: {"$in": data.filmUuids}});
            break;
    }
});

bot.on("inline_query", query => {
    Film.find({}).then(films => {
        const results = films.map(f => {
            const caption = `Название:  ${f.name}\nГод:  ${f.year}\nРейтинг:  ${f.rate}\nДлительность:  ${f.length}\nСтрана:  ${f.country}`;
            return {
                id: f.uuid,
                type: "photo",
                photo_url: f.picture,
                thumb_url: f.picture,
                caption: caption,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: `Кинопоиск ${f.name}`,
                                url: f.link,
                            },
                        ],
                    ],
                },
            };
        });
        bot.answerInlineQuery(query.id, results, {
            cache_time: 0,
        });
    });
});

//===========================================================

function sendFilmsByQuery(chatId, query) {
    Film.find(query).then(films => {
        const html = films.map((f, i) => {
            return `<b>${i + 1}</b> ${f.name} - /f${f.uuid}`
        }).join("\n");

        sendHTML(chatId, html, "films");
    }).catch(error => console.log(error));
}

function sendHTML(chatId, html, kbName = null) {
    const options = {
        parse_mode: "HTML",
    };
    if (kbName) {
        options["reply_markup"] = {
            keyboard: keyboard[kbName],
            resize_keyboard: true,
        };
    };
    bot.sendMessage(chatId, html, options);
}

function getCinemasInCoord(chatId, location) {
    Cinema.find({}).then(cinemas => {
        cinemas.forEach(c => {
            c.distance = geolib.getDistance(location, c.location) / 1000;
        });
        cinemas = _.sortBy(cinemas, "distance");

        const html = cinemas.map((c, i) => {
            return `<b>${i + 1}</b> ${c.name}. <em>Расстояние</em> - <strong>${c.distance}</strong> км. /c${c.uuid}`;
        }).join('\n');
        sendHTML(chatId, html, "home"); 
    })
}

function toggleFavouriteFilm(userId, queryId, {filmUuid, isFav}) {
    let userPromise; 

    User.findOne({telegramId: userId})
        .then(user => {
            if (user) {
                if (isFav) {
                    user.films = user.films.filter(fUuid => fUuid !== filmUuid);
                } else {
                    user.films.push(filmUuid);
                }
                userPromise = user;
            } else {
                userPromise = new User({
                    telegramId: userId,
                    films: [filmUuid],
                });
            }

            const answerText = isFav ? "Удалено" : "Добавлено";

            userPromise.save().then(_ => {
                bot.answerCallbackQuery(queryId, answerText);
            }).catch(err => console.log(err));
        }).catch(err => console.log(err));
}

function showFavouriteFilms(chatId, telegramId) {
    User.findOne({telegramId}).then(user => {
        if (user) {
            Film.find({uuid: {"$in": user.films}}).then(films => {
                let html;
                if (films.length) {
                    html = films.map((f, i) => {
                        return `<b>${i + 1}</b> ${f.name} - <b>${f.rate}</b> (/f${f.uuid})`;
                    }).join("\n");
                } else {
                    html = "Вы пока ничего не добавили";
                }
                sendHTML(chatId, html, "home");
            });
        } else {
            sendHTML(chatId, "Вы пока ничего не добавили", "home");
        }
    });
}

function sendCinemasByQuery(userId, query) {
    Cinema.find(query).then(cinemas => {
        const html = cinemas.map((c, i) => {
            return `<b>${i + 1}</b> ${c.name} - /c${c.uuid}`
        }).join("\n");
        sendHTML(userId, html, "home");
    });
}

