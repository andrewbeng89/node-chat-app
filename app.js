// TODO: index/search, improve UI

var express = require('express')
  , app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server)
  , fdb = require('fdb').apiVersion(21)
  , id = 0


// HELPERS --------------------------

function sanitize_for_json(string) {
  string = string ? string : ''
  string = string.replace(/\"/g, '\\"')
  string = string.replace(/\s/g, ' ')
  return string.replace(/\\/g, '\\\\')
}


// LOADING FROM DB --------------------------

function load_chats(callback, since) {
  db.doTransaction(function(tr) {
    var range = fdb.tuple.range(['chat'])
    var start
    if (since) {
      start = fdb.tuple.pack(['chat', since + 1])
    } else {
      start = range.begin
    }
    var iterator = tr.getRange(start, range.end)
    iterator.toArray(function(err, chats) {
      var new_chats = []
      for (chat in chats) {
        var chat_json = chats[chat].value.toString()
        new_chats.push(JSON.parse(chat_json))
        id = fdb.tuple.unpack(chats[chat].key)[1]
        console.log(id + ' ->',  chat_json)
      }
      callback(new_chats)
    })
  })
}

function load_users(callback) {
  var range = fdb.tuple.range(['users'])
  db.getRange(range.begin, range.end, {}, function(err, users) {
    var user_list = []
    for (user in users) {
      var name = users[user].value.toString()
      user_list.push(name)
    }
    callback(user_list)
  })
}

function load_all(callback, since) {
  var data = {}
  load_chats(function(chats) {
    data.chats = chats
    load_users(function(users) {
      data.users = users
      callback(data)
    })
  }, since)
}


// SAVING TO DB --------------------------

function save_event(json) {
  db.doTransaction(function(tr, commit) {
    var range = fdb.tuple.range(['chat'])
    var iterator = tr.getRange(range.begin, range.end, { reverse: true, limit: 1 })
    iterator.toArray(function(err, chats) {
      var most_recent = chats[0]
      if (most_recent) {
        var new_id = fdb.tuple.unpack(most_recent.key)[1] + 1
      } else {
        var new_id = id + 1
      }
      console.log('newest id is', new_id)
      tr.set(fdb.tuple.pack(['chat', new_id]), json)
      commit()
    })
  })
}

function save_chat(user, comment, id) {
  user = sanitize_for_json(user)
  comment = sanitize_for_json(comment)
  save_event('{"user":"' + user + '", "comment": "' + comment + '", "time": ' + (new Date()).getTime() + ', "id": "' + id + '", "type": "chat"}')
}

function save_presence(user, type) {
  user = sanitize_for_json(user)
  save_event('{"user":"' + user + '", "time": ' + (new Date()).getTime() + ', "type": "' + type + '"}')
}

function broadcast_users(err, users) {
  var user_list = []
  for (user in users) {
    var name = users[user].value.toString()
    user_list.push(name)
  }
  console.log('existing users', user_list)
}

function add_user(user) {
  console.log('adding user:', user)
  user = sanitize_for_json(user)
  db.doTransaction(function(tr, commit) {
    tr.set(fdb.tuple.pack(['users', user]), user)
    var range = fdb.tuple.range(['users'])
    tr.getRange(range.begin, range.end).toArray(function(err, users) {
      commit(null, users)
    })
  }, broadcast_users)
}

function remove_user(user) {
  console.log('removing user:', user)
  user = sanitize_for_json(user)
  db.doTransaction(function(tr, commit) {
    tr.clear(fdb.tuple.pack(['users', user]))
    var range = fdb.tuple.range(['users'])
    tr.getRange(range.begin, range.end).toArray(function(err, users) {
      commit(null, users)
    })
  }, broadcast_users)
}


// ROUTES --------------------------

app.get('/', function (req, res) { res.sendfile(__dirname + '/public/index.html') })
app.get('/log', function(req, res) {
  load_all(function(data) {
    res.send(data)
  })
})
app.use(express.static(__dirname + '/public'))


// SOCKET LISTENERS --------------------------

io.set('log level', 1)
io.sockets.on('connection', function (socket) {

  socket.on('join', function(name) {
    console.log(name, ' joined')
    add_user(name)
    save_presence(name, 'joined')
  })
  
  socket.on('message', function (name, comment, id) {
    console.log(name, ': ', comment)
    save_chat(name, comment, id)
  })

  socket.on('leave', function(name) {
    console.log(name, ' disconnected')
    remove_user(name)
    save_presence(name, 'disconnected')
  })
})


// BOOT --------------------------

function lookup_latest_and_start_polling() {
  db.doTransaction(function(tr) {
    var range = fdb.tuple.range(['chat'])
    var iterator = tr.getRange(range.begin, range.end, { reverse: true, limit: 1 })
    iterator.toArray(function(err, chats) {
      var most_recent = chats[0]
      if (most_recent) {
        id = fdb.tuple.unpack(most_recent.key)[1] + 1
      }
      setInterval(check_db_for_updates, 1000)
    })
  })
}

function check_db_for_updates() {
  load_all(function(data) {
    io.sockets.emit('updates', data)
  }, id)
}

console.log('Opening the db...')
fdb.open(null, null, function(err, the_db) {
  db = the_db
  var port = 1234
  if (process.argv[2]) {
    port = process.argv[2]
  }
  console.log('Starting the web server on port...', port)
  server.listen(port)
  console.log('Looking up latest and starting to poll...')
  lookup_latest_and_start_polling()
})