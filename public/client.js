function scroll_to_bottom() {
  $('html, body').scrollTop($(document).height())
}
function append_chat(chat, pending) {
  var date = new Date(chat.time)
  var $existing_chat = $('#conversation tr#' + chat.id)
  if ($existing_chat.length > 0) {
    $existing_chat.removeClass('pending')
  } else {
    $('#conversation tbody').append('<tr id="' + chat.id + '"><td class="username"></td><td class="comment"></td><td class="timeago" title="' + date.toISOString() + '"></td>')
    var $tr = $('#conversation tr:last-child')
    if (pending) $tr.addClass('pending')
    $tr.find('.username').text(chat.user)
    $tr.find('.comment').text(chat.comment)
    $tr.find('.timeago').timeago()
    if (chat.user == my_name) {
      $tr.addClass('me')
    }
  }
  scroll_to_bottom()
  check_for_sound_notification(chat)
}
function append_join(chat) {
  var date = new Date(chat.time)
  $('#conversation tbody').append('<tr><td class="join" colspan="2"></td><td class="timeago" title="' + date.toISOString() + '"></td>')
  var $tr = $('#conversation tr:last-child')
  $tr.find('td:first-child').text(chat.user + ' has joined the room.')
  $tr.find('.timeago').timeago()
  scroll_to_bottom()
}
function append_disconnect(chat) {
  var date = new Date(chat.time)
  $('#conversation tbody').append('<tr><td class="disconnect" colspan="2"></td><td class="timeago" title="' + date.toISOString() + '"></td>')
  var $tr = $('#conversation tr:last-child')
  $tr.find('td:first-child').text(chat.user + ' has left the room.')
  $tr.find('.timeago').timeago()
  scroll_to_bottom()
}
function update_users(users) {
  $('#users').empty()
  for (var i=0; i<users.length; i++) {
    $('#users').append('<li></li>')
    $('#users li:last-child').text(users[i])
  }
}
function add_user(user) {
  users.push(user)
}
function remove_user(user) {
  for (var i=users.length=1; i>=0; i--) {
    if (users[i] === user) users.splice(i, 1)
  }
}

// SOUND NOTIFICATION HANDLING
var sound_off = false, ding
function check_for_sound_notification(chat) {
  if (!ding) return
  if (sound_off) return
  if (chat.user == my_name) return
  if (chat.comment.toLowerCase().indexOf(my_name.toLowerCase()) == -1) return
  ding.play()
}
function toggle_sound() {
  sound_off = !sound_off
  $('#toggle-sound').toggleClass('off')
  if (sound_off) $.cookie('sound', 'off')
  else $.cookie('sound', 'on')
  return false
}
function load_sound_preference() {
  if ($.cookie('sound') == 'off') sound_off = true
  else sound_off = false
  if (sound_off) $('#toggle-sound').addClass('off')
}


var socket = io.connect('/')
var users = []
var my_name

socket.on('updates', function (data) {
  var updates = data.chats
  for (var i=0; i<updates.length; i++) {
    var update = updates[i]
    switch (update.type) {
    case 'joined':
      append_join(update)
      break
    case 'disconnected':
      append_disconnect(update)
      break
    case 'chat':
      append_chat(update)
      break
    }
  }
  if (data.users) update_users(data.users)
})

socket.on('users', function(users) {
  update_users(users)
})

$(function(){
  
  $.get('/log', function(data) {
    var chats = data.chats
    for (var i=0; i<chats.length; i++) {
      var chat = chats[i]
      switch (chat.type) {
        case 'chat':
          append_chat(chat)
          break
        case 'joined':
          add_user(chat.user)
          append_join(chat)
          break
        case 'disconnected':
          remove_user(chat.user)
          append_disconnect(chat)
          break
      }
    }
    update_users(data.users)
    scroll_to_bottom()
  })
  
  ding = $('#ding').get(0)
  $('#toggle-sound').click(toggle_sound)
  load_sound_preference()
  
  my_name = $.cookie('name')
  while ((typeof(my_name) == 'undefined') || (my_name === '') || (my_name.match(/^\s$/))) {
    my_name = prompt("What's your name?")
  }
  $.cookie('name', my_name)
  socket.emit('join', my_name)
  
  $('#send').click(function() {
    var message = $('#the-comment').val()
    $('#the-comment').val('').focus()
    var id = uuid.v4()
    append_chat({ user: my_name, comment: message, type: 'chat', id: id, time: (new Date()).getTime() }, true)
    socket.emit('message', my_name, message, id)
  })

  $('#the-comment').keypress(function(e) {
    if(e.which == 13) {
      if ($('#the-comment').val() != '') {
        $(this).blur()
        $('#send').focus().click()
      }
      return false
    }
  })
  
  $('#the-comment').focus()
  
  $(window).unload(function() { socket.emit('leave', my_name) })
})