const sharp = require('sharp');
const path = require('path');

async function flipFarmlandTile() {
    const input = 'public/assets/backgrounds/playmat/farmland/masters/pm_board_farmland_irrigated_end_master.png';
    const outputMaster = 'public/assets/backgrounds/playmat/farmland/masters/pm_board_farmland_irrigated_start_master.png';
    
    await sharp(input)
        .flop() // Horizontal flip
        .toFile(outputMaster);

    console.log(`Successfully flipped ${input} to ${outputMaster}`);
}

flipFarmlandTile();
