let currentLevel = 1;
let levels = {
    1: {grid:  ['.', '.'], maxPeeks: 1},
    2: {grid: ['.', '.', '.', '.'], maxPeeks: 1},
    3: {grid: ['.', '.', '.', '.', '.'], maxPeeks: 1},
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
}


let grid = levels[currentLevel].grid;
let pastGrid = Array(grid.length).fill(0);
let maxPeeks = levels[currentLevel].maxPeeks;

let images = {
    '.': "<img class='symbol' src='images/chicken.png' draggable='false'></img>",
    'x': "<img class='symbol' src='images/x.png' draggable='false'></img>",
    '-': "<img class='symbol' src='images/-.png' draggable='false'></img>",
}

$(function(){ 
    $('h2').empty().append('Level ' + currentLevel + ' - Max Peeks = ' + maxPeeks);

    drawGrid();
});


function drawGrid() {
    let isNestedArray = Array.isArray(grid[0]);
    
    $('.boxes').empty();

    if (isNestedArray) {
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
    } else {
        for(let i=0; i<grid.length; i++) {
            $('.boxes').append(`
                <span class="square" id=${i}>
                    ${images[grid[i]]}
                </span>
            `);
        }
    }
}

function buttonCheck() {
    let disabled = grid.flat().filter(el => el === 'x').length < 1;

    $('button').attr("disabled", disabled);
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
            nextLevel();
        }, delay * (grid.flat().length + 1))
    }
 }

 function nextLevel() {
    currentLevel++;
    grid = levels[currentLevel].grid;
    maxPeeks = levels[currentLevel].maxPeeks;
    $('h2').empty().append('Level ' + currentLevel + ' - Max Peeks = ' + maxPeeks);
    drawGrid();
 }

$(document).on('click', '.square', function() {
    let isNestedArray = Array.isArray(grid[0]);

    if (isNestedArray) {
        let row = parseInt($(this)[0].id.split('|')[0]);
        let column = parseInt($(this)[0].id.split('|')[1]);
        let canCheckMore = grid.flat().filter(el => el === 'x').length < maxPeeks;

        switch (grid[row][column]){
            case '.': 
                if (canCheckMore) {
                    grid[row][column] = 'x';
                }
        }
    } else {
        let clicked = parseInt($(this)[0].id);
        let canCheckMore = grid.filter(el => el === 'x').length < maxPeeks;

        switch (grid[clicked]){
            case '.': 
                pastGrid = [...grid];
                if (canCheckMore) {
                  grid[clicked] = 'x';
                }
                break;
            case 'x':
                grid[clicked] = pastGrid[clicked];
                break;
        }
    }

    drawGrid();
    buttonCheck();
});

$(document).on('click', 'button', function(e) {
    let isNestedArray = Array.isArray(grid[0]);
    let newGrid = [];

    if (isNestedArray) {
        newGrid = JSON.parse(JSON.stringify(grid));

        for(let row=0; row<grid.length; row++) {
            for(let column=0; column<grid[row].length; column++) {
                if (grid[row][column] === '') {
                    newGrid[row][column] = '';
                    continue;
                }

                let neighbors = [[0, -1], [0, 1], [1, 0], [-1, 0]];
                let hasNeighbor = false;

                neighbors.forEach(neighbor => {
                    if (row + neighbor[0] >= 0 && row + neighbor[0] < grid.length){
                        if (column + neighbor[1] >= 0 && column + neighbor[1] < grid[row].length){
                            if (grid[row+neighbor[0]][column+neighbor[1]] === '.') {
                                hasNeighbor = true;
                            }
                        }
                    }
                });

                if (hasNeighbor) {
                    newGrid[row][column] = '.';
                } else {
                    newGrid[row][column] = '-';
                }
            }
        }
    } else {
        newGrid = Array(grid.length).fill(0);

        for(let i=0; i<grid.length; i++) {
            let leftChicken = false;
            let rightChicken = false;

            if (i-1 >= 0 && grid[i-1] === '.') {
                leftChicken = true;
            }

            if (i+1 < grid.length && grid[i+1] === '.') {
                rightChicken = true;
            }

            if (leftChicken || rightChicken) {
                newGrid[i] = '.';
            } else {
                newGrid[i] = '-';
            }
        }
    }

    grid = newGrid;
    drawGrid();
    buttonCheck();
    checkWin();
});