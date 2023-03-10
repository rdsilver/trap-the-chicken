let currentLevel = 1;
let levels = {
    1: {grid:  [['.', '.']], maxPeeks: 1},
    2: {grid: [['.', '.', '.', '.']], maxPeeks: 1},
    3: {grid: [['.', '.', '.', '.', '.']], maxPeeks: 1},
    4: {grid: [['.', '.'],
               ['.', '.']], maxPeeks: 2},
    5: {grid: [['.', '.', '.'],
               ['.', '.', '.'],
               ['.', '.', '.']], maxPeeks: 3},
    6: {grid: [['.', '.', '.', '.'],
               ['.', '.', '.', '.'],
               ['.', '.', '.', '.'],
               ['.', '.', '.', '.']], maxPeeks: 5},
    7: {grid: [['.', '.', '.', '.'],
               ['.', '', '', '.'],
               ['.', '', '', '.'],
               ['.', '.', '.', '.']], maxPeeks: 2},
    8: {grid: [['.', '.', '.', '.'],
               ['.', '', '.', '.'],
               ['.', '.', '', '.'],
               ['.', '.', '.', '.']], maxPeeks: 2},
    9: {grid: [['.', '.', '.', '.'],
               ['.', '.', '.', '.'],
               ['.', '.', '.', '.'],
               ['.', '.', '.', '.']], maxPeeks: 4},
    10: {grid: [['.', '.', '.', '.'],
               ['', '.', '.', ''],
               ['', '', '.', ''],
               ['.', '.', '.', '.']], maxPeeks: 2},
    11: {grid: [['k', 'k', 'k', 'k', 'k'],
                ['k', 'k', 'k', 'k', 'k'],
                ['k', 'k', 'k', 'k', 'k'],
                ['k', 'k', 'k', 'k', 'k'],
                ['k', 'k', 'k', 'k', 'k']], maxPeeks: 8},
    12: {grid: [['s', 's', 's', 's', 's'],
                ['s', 's', 's', 's', 's'],
                ['s', 's', 's', 's', 's'],
                ['s', 's', 's', 's', 's'],
                ['s', 's', 's', 's', 's']], maxPeeks: 12},
    13: {grid: [['.', '.', '.', '.'],
               ['', '.', '', '.'],
               ['', '.', '', '.'],
               ['.', '.', '.', '.']], maxPeeks: 2},
}
let pieceMoves = {
    '.': [[0, -1], [0, 1], [1, 0], [-1, 0]],
    'k': [[-2, -1], [-1, -2], [1, -2], [1, 2], [-2, 1], [2 ,1], [2, -1], [-1, 2]],
    's': [[0, -1], [0, 1], [1, 0], [-1, 0], [0, -2], [0, 2], [2, 0], [-2, 0]],
}


let grid = JSON.parse(JSON.stringify(levels[currentLevel].grid)); 
let pastGrid = Array(grid.length).fill(0);
let maxPeeks = levels[currentLevel].maxPeeks;

let images = {
    '.': "<img class='symbol' src='images/chicken.png' draggable='false'></img>",
    'x': "<img class='symbol' src='images/x.png' draggable='false'></img>",
    '-': "<img class='symbol' src='images/-.png' draggable='false'></img>",
    'k': "<img class='symbol' src='images/knight.png' draggable='false'></img>",
    's': "<img class='symbol' src='images/rooster.png' draggable='false'></img>",
}

$(function(){ 
    $('h2').empty().append('Level ' + currentLevel + ' - Max Peeks = ' + maxPeeks);
    drawGrid();
    levelSelector();
});


function drawGrid() {    
    $('.boxes').empty();

    for(let i=0; i<grid.length; i++) {
        let row = grid[i];

        $('.boxes').append(`<div class="row"> </div>`);

        for(let j=0; j<row.length; j++) {
            if (row[j] === '') {
                $('.row:last').append(`
                <span class="square empty">
                </span>
            `);
            } else {
                $('.row:last').append(`
                    <span class="square" id=${i+'|'+j}>
                        ${images[row[j]]}
                    </span>
                `);
            }
        }
    }
}

function levelSelector() {
    for (let i=0; i<Object.keys(levels).length; i++) {
        $('body').append(`<div class='level'>Level ${i + 1}</div>`);
    }
}

function buttonCheck() {
    let disabled = grid.flat().filter(el => el === 'x').length < 1;
    let autoCheck = !disabled && grid.flat().filter(el => el === 'x').length === maxPeeks && $('input').is(':checked');

    $('button').attr("disabled", disabled);

    if (autoCheck) {
        setTimeout(() => {
            $('button').click();
        }, 300)
    }
}

function checkWin() {
    let win = grid.flat().filter(el => (el === '-' || el === '')).length === grid.flat().length;
    let delay = 1000 / grid.flat().length;

    if (win) {
        $('.square:not(.empty)').each(function(index) {
            setTimeout(() => {
                $(this).addClass('win')
              }, delay * index)
        });


        setTimeout(() => {
            setLevel(currentLevel + 1);
        }, delay * (grid.flat().length + 1))
    }
 }

 function setLevel(newLevel) {
    currentLevel = newLevel;
    grid = JSON.parse(JSON.stringify(levels[currentLevel].grid)); 
    maxPeeks = levels[currentLevel].maxPeeks;
    $('h2').empty().append('Level ' + currentLevel + ' - Max Peeks = ' + maxPeeks);
    drawGrid();
 }

$(document).on('click', '.square', function() {
    let row = parseInt($(this)[0].id.split('|')[0]);
    let column = parseInt($(this)[0].id.split('|')[1]);
    let canCheckMore = grid.flat().filter(el => el === 'x').length < maxPeeks;

    switch (grid[row][column]){
        case '.': 
        case 'k':
        case 's':
            if (canCheckMore) {
                grid[row][column] = 'x';
            }
    }

    drawGrid();
    buttonCheck();
});

$(document).on('click', 'input', function() {
    buttonCheck();
});

$(document).on('click', '.level', function() {
    setLevel(parseInt($(this).text().split(' ')[1]));
});

$(document).on('click', '#auto-check', function() {
    $('input').attr("checked", !$('input').attr("checked"));
});

$(document).on('click', 'button', function() {
    let newGrid = JSON.parse(JSON.stringify(grid));
    
    for(let row=0; row<grid.length; row++) {
        for(let column=0; column<grid[row].length; column++) { 
            newGrid[row][column] = 'placeholder';
        }
    }

    for (const [key, value] of Object.entries(pieceMoves)) {
        let neighbors = value;

        for(let row=0; row<grid.length; row++) {
            for(let column=0; column<grid[row].length; column++) {
                if (grid[row][column] === '') {
                    newGrid[row][column] = '';
                    continue;
                }

                let hasNeighbor = neighbors.some(neighbor => {
                    if (row + neighbor[0] >= 0 && row + neighbor[0] < grid.length) {
                        if (column + neighbor[1] >= 0 && column + neighbor[1] < grid[row].length) {
                            if (grid[row+neighbor[0]][column+neighbor[1]] === key) {
                                return true;
                            }
                        }
                    }

                    return false;
                });

                if (hasNeighbor) {
                    newGrid[row][column] = key;
                }
            }
        }
    }

    for(let row=0; row<grid.length; row++) {
        for(let column=0; column<grid[row].length; column++) { 
            if (newGrid[row][column] === 'placeholder') {
                newGrid[row][column] = '-';
                continue;
            }
        }
    }
   

    grid = newGrid;
    drawGrid();
    buttonCheck();
    checkWin();
});