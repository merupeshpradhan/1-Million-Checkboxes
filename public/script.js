const socket = io();
const grid = document.getElementById('grid');

// Let's just create 400 boxes for testing (1 million needs Canvas later)
for (let i = 0; i < 400; i++) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = `box-${i}`;
    cb.onclick = () => {
        socket.emit('toggle', { index: i, value: cb.checked });
    };
    grid.appendChild(cb);
}

// Receive updates from other users
socket.on('update', (data) => {
    const box = document.getElementById(`box-${data.index}`);
    if (box) box.checked = data.value;
});

socket.on('error', (err) => alert(err.message));
