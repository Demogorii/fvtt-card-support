import { mod_scope } from "./constants.js";
import { cardHotbarSettings } from "../cardhotbar/scripts/card-hotbar-settings.js";
Hooks.on("renderTokenHUD", (tokenHUD, html, options) => {
  console.log(tokenHUD);
  console.log(html);
  if (tokenHUD.object.data.flags?.[mod_scope]?.deckID) {
    html.find(".combat").remove();
    html.find(".effects").remove();
    html.find(".target").remove();
    deckHUD(tokenHUD.object.data, html);
  }
});
async function deckHUD(td, html) {
  const deckID = td.flags[mod_scope]["deckID"];
  // Draw To Hand
  // Draw to Hand Flipped (?)
  const handDiv = $(
    '<i class="control-icon fa fa-hand-paper" aria-hidden="true" title="Draw"></i>'
  );
  html.find(".right").append(handDiv);
  handDiv.click((ev) => draw(td));
  // Show Discard
  // Add Discard Back to Deck
  const discardDiv = $(
    '<i class="control-icon fa fa-trash" aria-hidden="true" title="Discard Pile"></i>'
  );
  html.find(".right").append(discardDiv);
  discardDiv.click((ev) => showDiscard());
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
  const dealDiv = $(
    '<i class="control-icon icon-deal" title="Deal to players"></i>'
  );
  html.find(".left").append(dealDiv);
  dealDiv.click((ev) => dealCards());
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
                let card = deck.infiniteDraw();
                if (drawTable) {
                  let tex = await loadTexture(
                    game.journal.get(card).data["img"]
                  );
                  await Tile.create({
                    img: game.journal.get(card).data["img"],
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
                  let tex = await loadTexture(
                    game.journal.get(card).data["img"]
                  );
                  await Tile.create({
                    img: game.journal.get(card).data["img"],
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
      if (user.isSelf == false) {
        players += `<option value=${user.id}>${user.name}</option>`;
      }
    }
    let dealCardsDialog = `
    <h2> Deal Cards To Player </h2>
    <div style="display:flex; flex-direction:column">
      <p style="display:flex">
       <span style="flex:2"> Player: </span>
       <select id="player" style="flex:1">${players}</select>
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
            let _cardIDs = [];
            for (let i = 0; i < html.find("#numCards")[0].value; i++) {
              if (html.find("#infinite")[0].checked) {
                _cardIDs.push(deck.infiniteDraw());
              } else {
                _cardIDs.push(await deck.drawCard());
              }
            }
            let socketMsg = {
              type: "DEAL",
              deck: deck.deckName,
              from: game.user.id,
              to: html.find("#player")[0].value,
              cardIDs: _cardIDs,
            };
            //@ts-ignore
            game.socket.emit("module.cardsupport", socketMsg);
            console.log("emitting msg: ", socketMsg);
          },
        },
      },
    }).render(true);
  };
}
class DiscardPile extends Application {
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
      console.log(cardIds);
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
        ui["cardHotbar"].populator.addToHand([card]);
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
class ViewPile extends Application {
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
