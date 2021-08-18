import { ViewPile, DiscardPile } from "./tileHud.js";
export class DeckForm extends Application {

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.id = "deckinteractionform";
    options.title = "Decks";
    options.template = "modules/cardsupport/templates/deckform.html";
    options.classes = ["sheet"];
    return options;
  }

  getData() {
    let data = {
      decks: game.decks.decks,
    };
    return data;
  }

  async activateListeners(html) {
    console.log("activating listeners");
    for (let d of Object.values(game.decks.decks)) {
      let deck = d; //Draw Card Listener

      html.find(`#${deck.deckID}-draw`).click(() => {
        if (
          !game.user.isGM &&
          deck.deckName != "PlayerDeck"
        ) {
          ui.notifications.error("You don't have permission to do that.");
          return;
        }
        let takeDialogTemplate = `
        <div style="display:flex; flex-direction:column">
          <h3 style="flex:4">Draw regular card from deck?</h3>
          <input style="display:none" id="deckID" value=${deck.deckID} />
        </div>
        `;
        new Dialog({
          title: "Deck Action",
          content: takeDialogTemplate,
          buttons: {
            draw: {
              label: "Confirm",
              callback: (html) => {
                if (game.user.isGM) {
                  game.decks
                    .get(html.find("#deckID")[0].value)
                    .dealToPlayer(
                      game.user.id,
                      1,
                      false
                    );
                } else {
                  let msg = {
                    type: "DRAWCARDS",
                    playerID: game.users.find((el) => el.isGM && el.active).id,
                    receiverID: game.user.id,
                    deckID: html.find("#deckID")[0].value,
                    numCards: 1,
                    replacement: false,
                  }; //@ts-ignore

                  game.socket.emit("module.cardsupport", msg);
                }
              },
            },
            no: {
              label: "Cancel",
              callback: (html) => {

                }
              },
          },
        }).render(true);
      });
      html.find(`#${deck.deckID}-drawriver`).click(() => {
        if (
          !game.user.isGM &&
          deck.deckName != "PlayerDeck"
        ) {
          ui.notifications.error("You don't have permission to do that.");
          return;
        }
        let takeDialogTemplate = `
        <div style="display:flex; flex-direction:column">
          <h3 style="flex:4">Draw card and add to River?</h3>
          <input style="display:none" id="deckID" value=${deck.deckID} />
        </div>
        `;
        new Dialog({
          title: "Deck Action",
          content: takeDialogTemplate,
          buttons: {
            draw: {
              label: "Confirm",
              callback: (html) => {
                if (game.user.isGM) {
                  game.decks
                    .get(html.find("#deckID")[0].value)
                    .addNewCardToRiverToAllPlayers();
                } else {
                  let msg = {
                    type: "RIVER_ADD_REQ",
                    playerID: game.users.find((el) => el.isGM && el.active).id,
                    receiverID: game.user.id,
                    deckID: html.find("#deckID")[0].value,
                    numCards: 1,
                    replacement: false,
                  }; //@ts-ignore

                  game.socket.emit("module.cardsupport", msg);
                }
              },
            },
            no: {
              label: "Cancel",
              callback: (html) => {

                }
              },
          },
        }).render(true);
      });
    }
  }
}


export class ViewJournalPile extends Application {
  deckID = "";
  cards = [];

  constructor(obj, opts = {}) {
    super(obj, opts);
    this.deckID = obj["deckID"];
    this.cards = obj["cards"];

    if (game.settings.get("cardsupport", "chatMessageOnPlayerAction")) {
      ChatMessage.create({
        speaker: {
          alias: game.user.name,
        },
        content: `
        <p>${game.user.name} is looking at ${this.cards.length} cards from ${
          game.decks.get(this.deckID).deckName
        }!</p>
        `,
      });
    }
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
    //Journal Entries passed in get stripped down so they don't have data, which breaks cardgrid, so we're adding the nesting back in
    let cards = this.cards.map((el) => {
      return {
        data: el,
        _id: el["_id"],
      };
    });
    let data = {
      cards: cards,
      discard: false,
    };
    console.log(data);
    return data;
  }

  async activateListeners(html) {
    let cardIDs = this.cards.map((el) => {
      return el["_id"];
    }); // Take

    for (let cardID of cardIDs) {
      html.find(`#${cardID}-take`).click(() => {
        if (ui["cardHotbar"].populator.getNextSlot() == -1) {
          ui.notifications.error("No more room in your hand");
          return;
        }

        ui["cardHotbar"].populator.addToPlayerHand([
          this.cards.find((el) => el["_id"] == cardID),
        ]); // GM SOCKET TO REMOVEFROMSTATE a Card

        let msg = {
          type: "REMOVECARDFROMSTATE",
          playerID: game.users.find((el) => el.isGM && el.active).id,
          deckID: this.deckID,
          cardID: cardID,
        }; //@ts-ignore

        game.socket.emit("module.cardsupport", msg);
        this.cards = this.cards.filter((el) => {
          return el._id != cardID;
        });

        if (game.settings.get("cardsupport", "chatMessageOnPlayerAction")) {
          ChatMessage.create({
            speaker: {
              alias: game.user.name,
            },
            content: `
            <p>${game.user.name} took a card from ${
              game.decks.get(this.deckID).deckName
            }!</p>
            `,
          });
        }

        this.render(true);
      });
      html.find(`#${cardID}-takecopy`).click(() => {
        if (ui["cardHotbar"].populator.getNextSlot() == -1) {
          ui.notifications.error("No more room in your hand");
          return;
        }

        ui["cardHotbar"].populator.addToPlayerHand([
          this.cards.find((el) => el["_id"] == cardID),
        ]);
        this.cards = this.cards.filter((el) => {
          return el._id != cardID;
        });

        if (game.settings.get("cardsupport", "chatMessageOnPlayerAction")) {
          ChatMessage.create({
            speaker: {
              alias: game.user.name,
            },
            content: `
            <p>${game.user.name} took a card as copy from ${
              game.decks.get(this.deckID).deckName
            }!</p>
            `,
          });
        }

        this.render(true);
      });
    }
  }
}


export class DiscardJournalPile extends Application {
  deckID = "";
  cards = [];

  constructor(obj, opts = {}) {
    super(obj, opts);
    this.deckID = obj["deckID"];
    this.cards = obj["cards"];

    if (game.settings.get("cardsupport", "chatMessageOnPlayerAction")) {
      ChatMessage.create({
        speaker: {
          alias: game.user.name,
        },
        content: `
        <p>${game.user.name} is viewing ${
          this.cards.length
        } from the discard of ${game.decks.get(this.deckID).deckName}!</p>
        `,
      });
    }
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "discardpile",
      title: "Discard Pile",
      template: "modules/cardsupport/templates/cardgrid.html",
      classes: ["sheet"],
    });
  }

  getData() {
    //Journal Entries passed in get stripped down so they don't have data, which breaks cardgrid, so we're adding the nesting back in
    let cards = this.cards.map((el) => {
      return {
        data: el,
        _id: el["_id"],
      };
    });
    let data = {
      cards: cards,
      discard: true,
    };
    console.log(data);
    return data;
  }

  async activateListeners(html) {
    let cardIDs = this.cards.map((el) => {
      return el["_id"];
    }); // Take

    for (let cardID of cardIDs) {
      html.find(`#${cardID}-take`).click(() => {
        if (ui["cardHotbar"].populator.getNextSlot() == -1) {
          ui.notifications.error("No more room in your hand");
          return;
        }

        ui["cardHotbar"].populator.addToPlayerHand([
          this.cards.find((el) => el["_id"] == cardID),
        ]); // GM SOCKET TO REMOVEFROMSTATE a Card

        let msg = {
          type: "REMOVECARDFROMDISCARD",
          playerID: game.users.find((el) => el.isGM && el.active).id,
          deckID: this.deckID,
          cardID: cardID,
        }; //@ts-ignore

        game.socket.emit("module.cardsupport", msg);
        this.cards = this.cards.filter((el) => {
          return el._id != cardID;
        });

        if (game.settings.get("cardsupport", "chatMessageOnPlayerAction")) {
          ChatMessage.create({
            speaker: {
              alias: game.user.name,
            },
            content: `
            <p>${game.user.name} took a card ${
              game.decks.get(this.deckID).deckName
            } discard pile!</p>
            `,
          });
        }

        this.render(true);
      });
      html.find(`#${cardID}-takecopy`).click(() => {
        if (ui["cardHotbar"].populator.getNextSlot() == -1) {
          ui.notifications.error("No more room in your hand");
          return;
        }

        ui["cardHotbar"].populator.addToPlayerHand([
          this.cards.find((el) => el["_id"] == cardID),
        ]);
        this.cards = this.cards.filter((el) => {
          return el._id != cardID;
        });

        if (game.settings.get("cardsupport", "chatMessageOnPlayerAction")) {
          ChatMessage.create({
            speaker: {
              alias: game.user.name,
            },
            content: `
            <p>${game.user.name} took a card as copy from ${
              game.decks.get(this.deckID).deckName
            } discard!</p>
            `,
          });
        }

        this.render(true);
      });
      html.find(`#${cardID}-burn`).click(() => {
        let msg = {
          type: "REMOVECARDFROMDISCARD",
          playerID: game.users.find((el) => el.isGM && el.active).id,
          deckID: this.deckID,
          cardID: cardID,
        }; //@ts-ignore

        game.socket.emit("module.cardsupport", msg);
        this.cards = this.cards.filter((el) => {
          return el._id != cardID;
        });

        if (game.settings.get("cardsupport", "chatMessageOnPlayerAction")) {
          ChatMessage.create({
            speaker: {
              alias: game.user.name,
            },
            content: `
            <p>${game.user.name} burnt a card from ${
              game.decks.get(this.deckID).deckName
            }!</p>
            `,
          });
        }

        this.render(true);
      });
      html.find(`#${cardID}-topdeck`).click(() => {
        let msg = {
          type: "CARDTOPDECK",
          playerID: game.users.find((el) => el.isGM && el.active).id,
          deckID: this.deckID,
          cardID: cardID,
        }; //@ts-ignore

        game.socket.emit("module.cardsupport", msg);
        this.cards = this.cards.filter((el) => {
          return el._id != cardID;
        });

        if (game.settings.get("cardsupport", "chatMessageOnPlayerAction")) {
          ChatMessage.create({
            speaker: {
              alias: game.user.name,
            },
            content: `
            <p>${game.user.name} returned a card to the top of the deck from ${
              game.decks.get(this.deckID).deckName
            }'s discard!</p>
            `,
          });
        }

        this.render(true);
      });
    }

    html.find(`#shuffleBack`).click(() => {
      let msg = {
        type: "SHUFFLEBACKDISCARD",
        playerID: game.users.find((el) => el.isGM && el.active).id,
        deckID: this.deckID,
      }; //@ts-ignore

      game.socket.emit("module.cardsupport", msg);
      this.cards = [];

      if (game.settings.get("cardsupport", "chatMessageOnPlayerAction")) {
        ChatMessage.create({
          speaker: {
            alias: game.user.name,
          },
          content: `
          <p>${game.user.name} shuffled the discard of ${
            game.decks.get(this.deckID).deckName
          } back into the deck!</p>
          `,
        });
      }

      this.render(true);
    });
    html.find(`#close`).click(() => {
      this.close();
    });
  }
}
