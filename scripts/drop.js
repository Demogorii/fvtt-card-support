import { mod_scope } from "./constants.js";
import { cardHotbarSettings } from "../cardhotbar/scripts/card-hotbar-settings.js";

// Add the listener to the board html element
Hooks.once("canvasReady", () => {
  document.getElementById("board").addEventListener("drop", async (event) => {
    // Try to extract the data (type + src)
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
      console.log(data);
      if (
        data.type == "Folder" &&
        game.decks.get(data.id) != undefined &&
        game.user.isGM
      ) {
        handleDroppedFolder(data.id, event.x, event.y);
      } else if (
        data.type == "JournalEntry" &&
        game.decks.getByCard(data.id) != undefined
      ) {
        if (game.user.isGM) {
          let t = canvas.background.worldTransform;
          handleDroppedCard(
            data.id,
            (event.clientX - t.tx) / canvas.stage.scale.x,
            (event.clientY - t.ty) / canvas.stage.scale.y,
            event.altKey
          );
        } else {
          let t = canvas.background.worldTransform;
          let msg = {
            type: "DROP",
            playerID: game.users.find((el) => el.isGM && el.active).id,
            cardID: data.id,
            x: (event.clientX - t.tx) / canvas.stage.scale.x,
            y: (event.clientY - t.ty) / canvas.stage.scale.y,
            alt: event.altKey,
          };
          //@ts-ignore
          game.socket.emit("module.cardsupport", msg);
        }
      } else if (
        data.type == "Macro" &&
        game.decks.getByCard(
          game.macros.get(data.id).getFlag(mod_scope, "cardID")
        ) != undefined
      ) {
        if (game.user.isGM) {
          let t = canvas.background.worldTransform;
          handleDroppedCard(
            game.macros.get(data.id).getFlag(mod_scope, "cardID"),
            (event.clientX - t.tx) / canvas.stage.scale.x,
            (event.clientY - t.ty) / canvas.stage.scale.y,
            event.altKey,
            game.macros.get(data.id).getFlag(mod_scope, "sideUp"),
            game.macros.get(data.id).getFlag(mod_scope, "river")
          );
          //await ui["cardHotbar"].populator.chbUnsetMacro(data.cardSlot);
          game.macros.get(data.id).delete();
        } else {
          let t = canvas.background.worldTransform;
          let msg = {
            type: "DROP",
            playerID: game.users.find((el) => el.isGM && el.active).id,
            cardID: game.macros.get(data.id).getFlag(mod_scope, "cardID"),
            x: (event.clientX - t.tx) / canvas.stage.scale.x,
            y: (event.clientY - t.ty) / canvas.stage.scale.y,
            alt: event.altKey,
            river: game.macros.get(data.id).getFlag(mod_scope, "river")
          };
          //@ts-ignore
          game.socket.emit("module.cardsupport", msg);
          await ui["cardHotbar"].populator.chbUnsetMacro(data.cardSlot);
          game.macros.get(data.id).delete();
        }
      }
    } catch (err) {
      console.error(err);
      return;
    }
  });
});

async function handleDroppedFolder(folderId, x, y) {
  return new Promise(async (resolve, reject) => {
    let t = canvas.background.worldTransform;
    const _x = (x - t.tx) / canvas.stage.scale.x;
    const _y = (y - t.ty) / canvas.stage.scale.y;

    if (game.settings.get("cardsupport", `${folderId}.settings`) != "" &&
        game.settings.get("cardsupport", `${folderId}.settings`)["value"] != ""
    ) {
      let deckImgTex = await loadTexture(
        game.settings.get("cardsupport", `${folderId}.settings`)["value"]["deckImg"]
      );
      Tile.create({
        name: game.folders.get(folderId).name,
        img: game.settings.get("cardsupport", `${folderId}.settings`)["value"]["deckImg"], //`modules/cardsupport/assets/${Math.floor(Math.random() * 10) + 1}.png`,
        x: _x,
        y: _y,
        width: deckImgTex.width/2, //350, //2, //350 for tile
        height: deckImgTex.height/2, //400, //400 for tile
        flags: {
          [mod_scope]: {
            deckID: folderId,
          },
        },
      });
      resolve();
    } else {
      Tile.create({
        name: game.folders.get(folderId).name,
        img: `modules/cardsupport/assets/${
          Math.floor(Math.random() * 10) + 1
        }.png`,
        x: _x,
        y: _y,
        width: 350, //2, //350 for tile
        height: 400, //400 for tile
        flags: {
          [mod_scope]: {
            deckID: folderId,
          },
        },
      });
    }
    resolve();
  });
}

export async function handleDroppedCard(cardID, x, y, alt, sideUp = "front", river = false) {
  let imgPath = "";
  if (alt || sideUp == "back") {
    imgPath = game.journal.get(cardID).getFlag(mod_scope, "cardBack");
  } else {
    imgPath = game.journal.get(cardID).data["img"];
  }

  // Determine the Tile Size:
  const tex = await loadTexture(imgPath);
  const _width = tex.width;
  const _height = tex.height;

  const cardScale = cardHotbarSettings.getCHBCardScale();
  console.debug(cardScale);


  let slotsToRemove = [];
  if (river)
  {
    let macros = ui["cardHotbar"].getcardHotbarMacros();
    macros.forEach(element =>
      {
          if (element.macro && element.macro.data.flags.world && element.macro.data.flags.world.river && element.macro.data.flags.world.cardID === cardID)
          {
            if (!game.user.isGM)
              ui["cardHotbar"].populator.chbUnsetMacro(element.slot);

             slotsToRemove.push(element.slot);
          }
      });
  }

  if (river && game.user.isGM)
  {
    for(let i = 0; i < slotsToRemove.length; i++)
    {
      await ui["cardHotbar"].populator.chbUnsetMacro(slotsToRemove[i]);
    }

    let macros = ui["cardHotbar"].getcardHotbarMacros();
    let journalEntries = [];
    macros.forEach(element =>
      {
          if (element.macro && element.macro.data.flags.world && element.macro.data.flags.world.river)
          {
            journalEntries.push(game.journal.get(element.macro.data.flags.world.cardID));
          }
      });
    game.river = journalEntries;

    let msg = {
      type: "SYNC_RIVER",
      river: game.river,
    };
    //@ts-ignore
    game.socket.emit("module.cardsupport", msg);
  }

  await Tile.create({
    img: imgPath,
    x: x,
    y: y,
    width: _width * cardScale,
    height: _height * cardScale,
    flags: {
      [mod_scope]: {
        cardID: `${cardID}`,
      },
    },
  });
}

/*
export async function handleTokenCard(cardID:string, x:number, y:number, alt:boolean, sideUp="front"){
  let imgPath = "";
  if(alt || sideUp == "back"){
    imgPath = game.journal.get(cardID).getFlag(mod_scope, "cardBack")
  } else {
    imgPath = game.journal.get(cardID).data['img']
  }

  // Determine the Tile Size:
  const tex = await loadTexture(imgPath);
  const _width = tex.width;
  const _height = tex.height;

  // Project the tile Position
  let t = canvas.background.worldTransform;
  const _x = (x - t.tx) / canvas.stage.scale.x
  const _y = (y - t.ty) / canvas.stage.scale.y

  const cardScale = cardHotbarSettings.getCHBCardScale();
  console.debug(cardScale);
  await Token.create({
    name: "Card",
    img: imgPath,
    x: _x,
    y: _y,
    width: 2 * cardScale,//_width * cardScale,
    height: 3 * cardScale, //_height * cardScale,
    permissions: 3,
    flags: {
      [mod_scope]: {
        "cardID": `${cardID}`,
      }
    }
  })
}
*/
