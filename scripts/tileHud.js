import { mod_scope } from "./constants.js";
import { cardHotbarSettings } from "../cardhotbar/scripts/card-hotbar-settings.js";
Hooks.on("renderTileHUD", (tileHUD, html, options) => {
  //console.log(tileHUD);
  //console.log(options.flags);
  if (options.flags?.[mod_scope]?.cardID != undefined) {
    cardHUD(tileHUD, html);
  } else if (options.flags?.[mod_scope]?.deckID != undefined) {
    deckHUD(tileHUD.object.data, html);
  }
});
async function cardHUD(tileHUD, html) {
  const handDiv = $(
    '<i class="control-icon fa fa-hand-paper" aria-hidden="true" title="Take"></i>'
  );
  const flipDiv = $(
    '<i class="control-icon fa fa-undo" aria-hidden="true" title="Flip"></i>'
  );
  const discardDiv = $(
    '<i class="control-icon fa fa-trash" aria-hidden="true" title="Discard"></i>'
  );
  const giveCardDiv = $(
    '<i class="control-icon icon-deal" title="Deal to players"></i>'
  );
  html.find(".left").append(handDiv);
  html.find(".left").append(flipDiv);
  html.find(".left").append(discardDiv);
  html.find(".left").append(giveCardDiv);
  handDiv.click((ev) => {
    takeCard(tileHUD.object.data);
  });
  flipDiv.click((ev) => {
    flipCard(tileHUD.object.data);
  });
  discardDiv.click((ev) => {
    discardCard(tileHUD.object.data);
  });
  giveCardDiv.click((ev) => {
    giveCard(tileHUD.object.data);
  });
  //Embdded Functions
  const flipCard = async (td) => {
    //Create New Tile at Current Tile's X & Y
    let cardEntry = game.journal.get(td.flags[mod_scope].cardID);
    let newImg = "";
    if (td.img == cardEntry.data["img"]) {
      // Card if front up, switch to back
      newImg = cardEntry.getFlag(mod_scope, "cardBack");
    } else if (td.img == cardEntry.getFlag(mod_scope, "cardBack")) {
      // Card is back up
      newImg = cardEntry.data["img"];
    } else {
      ui.notifications.error("What you doing m8? Stop breaking my code");
      return;
    }
    Tile.create({
      img: newImg,
      x: td.x,
      y: td.y,
      width: td.width,
      height: td.height,
      flags: td.flags,
    });
    //Delete this tile
    canvas.background.get(td._id).delete();
  };
  const takeCard = async (td) => {
    // UI.cardhotbar.populator.addToHand(cardID)
    // Delete this tile
    ui["cardHotbar"].populator.addToHand([td.flags[mod_scope]["cardID"]]);
    canvas.background.get(td._id).delete();
  };
  const discardCard = async (td) => {
    // Add Card to Discard for the Deck
    let deckId = game.journal.get(td.flags[mod_scope].cardID).data["folder"];
    console.log("Deck ID: ", deckId);
    game.decks.get(deckId).discardCard(td.flags[mod_scope].cardID);
    // Delete Tile
    canvas.background.get(td._id).delete();
  };
  const giveCard = async (td) => {
    let players = "";
    //@ts-ignore
    for (let user of game.users.contents) {
      if (user.isSelf == false && user.active) {
        players += `<option value=${user.id}>${user.name}</option>`;
      }
    }
    let dialogHTML = `
    <p> Player <select id="player">${players}</select> </p>
    `;
    new Dialog({
      title: "Give Card to Player",
      content: dialogHTML,
      buttons: {
        give: {
          label: "Give",
          callback: async (html) => {
            let _to = html.find("#player")[0].value;
            if (game.user.isGM) {
              game.decks.giveToPlayer(_to, td.flags[mod_scope].cardID);
            } else {
              let msg = {
                type: "GIVE",
                playerID: game.users.find((el) => el.isGM && el.active).id,
                to: _to,
                cardID: td.flags[mod_scope].cardID,
              };
              //@ts-ignore
              game.socket.emit("module.cardsupport", msg);
            }
            //delete tile
            await canvas.scene.deleteEmbeddedEntity("Tile", td._id);
          },
        },
      },
    }).render(true);
  };
}
async function deckHUD(td, html) {
  const deckID = td.flags[mod_scope]["deckID"];
  // Draw To Hand
  // Draw to Hand Flipped (?)
  const handDiv = $(
    '<i class="control-icon fa fa-hand-paper" aria-hidden="true" title="Draw"></i>'
  );
  html.find(".left").append(handDiv);
  handDiv.click((ev) => draw(td));
  // Show Discard
  // Add Discard Back to Deck
  const discardDiv = $(
    '<i class="control-icon fa fa-inbox" aria-hidden="true" title="Discard Pile"></i>'
  );
  html.find(".left").append(discardDiv);
  discardDiv.click((ev) => showDiscard());

  const riverDiv = $(
    '<i class="control-icon fa fa-hand-paper" aria-hidden="true" title="Draw To River"></i>'
  );
  html.find(".left").append(riverDiv);
  riverDiv.click((ev) => addToRiver(td));
  // Reset Deck
  const resetDiv = $(
    '<i class="control-icon fa fa-undo" aria-hidden="true" title="Reset Deck (Original state, unshuffled, with all cards)"></i>'
  );
  html.find(".right").append(resetDiv);
  resetDiv.click((ev) => resetDeck());
  // Shuffle
  const shuffleDiv = $(
    '<i class="control-icon fa fa-random" aria-hidden="true" title="Shuffle"></i>'
  );
  html.find(".right").append(shuffleDiv);
  shuffleDiv.click((ev) => shuffleDeck());
  const viewDiv = $(
    '<i class="control-icon fa fa-eye" aria-hidden="true" title="View Deck"></i>'
  );
  html.find(".right").append(viewDiv);
  viewDiv.click((ev) => viewDeck());
  if (game.user.isGM) {
    const dealDiv = $(
      '<i class="control-icon icon-deal" title="Deal to players"></i>'
    );
    html.find(".right").append(dealDiv);
    dealDiv.click((ev) => dealCards());
  }
  let deck = game.decks.get(deckID);
  let deckName = game.folders.get(deckID).data.name;
  //Embedded Functions
  const draw = async (td) => {
    // Ask How many cards they want to draw, default 1
    // Tick Box to Draw to Table
    let takeDialogTemplate = `
    <div style="display:flex; flex-direction:column">

      <div style="display:flex; flex-direction:row">
        <h2 style="flex:4"> How many cards? </h2>
        <input type="number" id="numCards" value=1 style="width:50px"/>
      </div>

      <div style="display:flex; flex-direction:row">
        <h2 style="flex:4"> Draw with Replacement? </h2>
        <input type="checkbox" id="infiniteDraw"  style="flex:1"/>
      </div>

      <div style="display:flex; flex-direction:row">
        <h2 style="flex:4"> Draw to Table? </h2>
        <input type="checkbox" id="drawTable"  style="flex:1"/>
      </div>

      <input style="display:none" value="${td.x}" id="deckX">
      <input style="display:none" value="${td.y}" id="deckY">
    </div>
    `;
    new Dialog({
      title: "Take Cards",
      content: takeDialogTemplate,
      buttons: {
        take: {
          label: "Take Cards",
          callback: async (html) => {
            let numCards = html.find("#numCards")[0].value;
            let drawTable = html.find("#drawTable")[0].checked;
            if (html.find("#infiniteDraw")[0]?.checked) {
              for (let i = 0; i < numCards; i++) {
                console.log("I: ", i);
                let card = deck.infinteDraw();
                if (drawTable) {
                  console.debug("Card Hotbar | Drawing to table. FaceUp is: ");
                  let bool = cardHotbarSettings.getCHBDrawFaceUpTable();
                  console.debug(bool);
                  let imgPath = bool
                    ? game.journal.get(card).data["img"]
                    : game.journal.get(card).getFlag("world", "cardBack");
                  let tex = await loadTexture(imgPath);
                  await Tile.create({
                    img: imgPath,
                    x: html.find("#deckX")[0].value,
                    y: html.find("#deckY")[0].value,
                    z: 100 + i,
                    width: tex.width * cardHotbarSettings.getCHBCardScale(),
                    height: tex.height * cardHotbarSettings.getCHBCardScale(),
                    flags: {
                      [mod_scope]: {
                        cardID: card,
                      },
                    },
                  });
                } else {
                  await ui["cardHotbar"].populator.addToHand([card]);
                }
              }
            } else {
              for (let i = 0; i < numCards; i++) {
                let card = await deck.drawCard();
                if (drawTable) {
                  console.debug("Card Hotbar | Drawing to table. FaceUp is: ");
                  let bool = cardHotbarSettings.getCHBDrawFaceUpTable();
                  console.debug(bool);
                  let imgPath = bool
                    ? game.journal.get(card).data["img"]
                    : game.journal.get(card).getFlag("world", "cardBack");
                  let tex = await loadTexture(imgPath);
                  await Tile.create({
                    img: imgPath,
                    x: html.find("#deckX")[0].value,
                    y: html.find("#deckY")[0].value,
                    z: 100 + i,
                    width: tex.width * cardHotbarSettings.getCHBCardScale(),
                    height: tex.height * cardHotbarSettings.getCHBCardScale(),
                    flags: {
                      [mod_scope]: {
                        cardID: card,
                      },
                    },
                  });
                } else {
                  await ui["cardHotbar"].populator.addToHand([card]);
                }
              }
            }
          },
        },
      },
    }).render(true);
  };
  const addToRiver = async (td) => {
    // Ask How many cards they want to draw, default 1
    // Tick Box to Draw to Table
    game.playerdeck.addNewCardToRiverToAllPlayers();

  };
  const showDiscard = async () => {
    let discardPile = [];
    for (let card of deck._discard) {
      discardPile.push(game.journal.get(card));
    }
    new DiscardPile({ pile: discardPile, deck: deck }, {}).render(true);
  };
  const resetDeck = async () => {
    deck.resetDeck();
    ui.notifications.info(`${deckName} was reset to it's original state.`);
  };
  const shuffleDeck = async () => {
    deck.shuffle();
    ui.notifications.info(
      `${deckName} has ${deck._state.length} cards which were shuffled successfully!`
    );
  };
  const viewDeck = async () => {
    //ask how many cards they want to view, default value all cards
    let template = `
    <div>
      <p>
        <h3> How many cards do you want to view? </h3>
        <h3> Deck has ${deck._state.length} cards </h3>
        <input id="cardNum" value=${deck._state.length} type="number" style='width:50px;'/>
      </p>
    </div>
    `;
    new Dialog({
      title: "View Cards",
      content: template,
      buttons: {
        ok: {
          label: "View",
          callback: async (html) => {
            new ViewPile(
              {
                deckID: deck.deckID,
                viewNum: html.find("#cardNum")[0].value,
              },
              {}
            ).render(true);
          },
        },
      },
    }).render(true);
  };
  const dealCards = async () => {
    let players = "";
    //@ts-ignore
    for (let user of game.users.contents) {
      if (user.isSelf == false && user.active) {
        //players += `<option value=${user.id}>${user.name}</option>`
        players += `
        <div style="display:flex">
          <span style="flex:2">${user.data.name}</span><input style="flex:1" type="checkbox" id="${user.id}"/>
        </div>
        `;
      }
    }
    let dealCardsDialog = `
    <h2> Deal Cards To Player </h2>
    <div style="display:flex; flex-direction:column">
      <p style="display:flex; flex-direction:column">
        ${players}
      <p>
      <p  style="display:flex">
        <span style="flex:2"> Cards: </span>
        <input id="numCards" type="number" style="width:50px; flex:1" value=1 />
      </p>
      <p style="display:flex">
        <span style="flex:2"> Deal with Replacement? </span>
        <input id="infinite" type="checkbox" style="flex:1"/>
      </p>
    <div>
      `;
    new Dialog({
      title: "Deal Cards to Player",
      content: dealCardsDialog,
      buttons: {
        deal: {
          label: "Deal",
          callback: async (html) => {
            let inf = html.find("#infinite")[0].checked ? true : false;
            let numCards = html.find("#numCards")[0].value;
            //@ts-ignore
            for (let user of game.users.contents) {
              if (html.find(`#${user.id}`)[0]?.checked) {
                deck.dealToPlayer(user.id, numCards, inf);
              }
            }
          },
        },
      },
    }).render(true);
  };
}
export class DiscardPile extends Application {
  constructor(object, options = {}) {
    super(object, options);
    this.pile = object["pile"];
    this.deck = object["deck"];
  }
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "discardpile",
      title: "Discard Pile",
      template: "modules/cardsupport/templates/cardgrid.html",
      classes: ["sheet"],
      height: 600,
      width: 600,
    });
  }
  getData() {
    let data = {
      cards: this.pile,
      discard: true,
    };
    return data;
  }
  async activateListeners(html) {
    html.find("#close").click(() => {
      this.close();
    });
    html.find("#shuffleBack").click(() => {
      let cardIds = this.pile.map((el) => el._id);
      game.decks.get(this.deck.deckID).addToDeckState(cardIds);
      game.decks.get(this.deck.deckID).removeFromDiscard(cardIds);
      game.decks.get(this.deck.deckID).shuffle();
      this.pile = [];
      this.render(true);
    });
    // Take
    for (let card of this.pile) {
      //TAKE
      html.find(`#${card._id}-take`).click(() => {
        if (ui["cardHotbar"].populator.getNextSlot() == -1) {
          ui.notifications.error("No more room in your hand");
          return;
        }
        ui["cardHotbar"].populator.addToHand([card._id]);
        game.decks.get(this.deck.deckID).removeFromDiscard([card._id]);
        this.pile = this.pile.filter((el) => {
          return el._id != card._id;
        });
        this.render(true);
      });
      //TAKE COPY
      html.find(`#${card._id}-takecopy`).click(() => {
        if (ui["cardHotbar"].populator.getNextSlot() == -1) {
          ui.notifications.error("No more room in your hand");
          return;
        }
        ui["cardHotbar"].populator.addToHand([card._id]);
        this.close();
      });
      //BURN
      html.find(`#${card._id}-burn`).click(() => {
        game.decks.get(this.deck.deckID).removeFromDiscard([card._id]);
        ui.notifications.info(`${card._id} was removed from discard!`);
        this.pile = this.pile.filter((el) => {
          return el._id != card._id;
        });
        this.render(true);
      });
      //Return to Top of Deck
      html.find(`#${card._id}-topdeck`).click(() => {
        game.decks.get(this.deck.deckID).addToDeckState([card._id]);
        game.decks.get(this.deck.deckID).removeFromDiscard([card._id]);
        this.pile = this.pile.filter((el) => {
          return el._id != card._id;
        });
        this.render(true);
      });
    }
  }
}
export class ViewPile extends Application {
  constructor(obj, opts = {}) {
    super(obj, opts);
    this.deckID = "";
    this.viewNum = 0;
    this.deckID = obj["deckID"];
    this.viewNum = obj["viewNum"];
  }
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "viewpile",
      title: "View Deck",
      template: "modules/cardsupport/templates/cardgrid.html",
      classes: ["sheet"],
    });
  }
  getData() {
    let deck = game.decks.get(this.deckID);
    let cardIDs = deck._state.slice(deck._state.length - this.viewNum);
    let data = {
      cards: cardIDs
        .map((el) => {
          return game.journal.get(el);
        })
        .reverse(),
      discard: false,
    };
    return data;
  }
  async activateListeners(html) {
    let deck = game.decks.get(this.deckID);
    let cardIDs = deck._state.slice(deck._state.length - this.viewNum);
    // Take
    for (let card of cardIDs) {
      html.find(`#${card}-take`).click(() => {
        if (ui["cardHotbar"].populator.getNextSlot() == -1) {
          ui.notifications.error("No more room in your hand");
          return;
        }
        ui["cardHotbar"].populator.addToHand([card]);
        game.decks.get(this.deckID).removeFromState([card]);
        this.close();
      });
      html.find(`#${card}-takecopy`).click(() => {
        if (ui["cardHotbar"].populator.getNextSlot() == -1) {
          ui.notifications.error("No more room in your hand");
          return;
        }
        ui["cardHotbar"].populator.addToHand([card]);
        this.close();
      });
    }
  }
}
