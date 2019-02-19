import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./app";
import Synth from "./synth";
import Sequencer, { ScheduledNote } from "./sequencer";

import feb19tune from "./feb19tune.json";
import cityLifeSequence from "./city-life.json";

const context = new AudioContext();
const synth = new Synth(context);
const sequencer = new Sequencer(context, synth);

function handleClickPlayPause() {
  context.resume();
  sequencer.toggle();
  renderIfPlaying();
}

const track = feb19tune;
let currentSequence: ScheduledNote[] = track.sequence;
// try {
//     currentSequence = JSON.parse(window.localStorage.getItem('sequence') || '[]');
// } catch (e) {
//     currentSequence = cityLifeSequence;
// }

// currentSequence = mySequence;

sequencer.setSequence(currentSequence);
render();

function handleChangeSequence(sequence: ScheduledNote[]) {
  currentSequence = sequence;
  window.localStorage.setItem("sequence", JSON.stringify(sequence));
  sequencer.setSequence(currentSequence);
  render();
}

function renderIfPlaying() {
  render();
  if (sequencer.getPlayingState()) {
    requestAnimationFrame(renderIfPlaying);
  }
}

const autoPlay = false;
if (autoPlay) {
  handleClickPlayPause();
}

function render() {
  ReactDOM.render(
    <App
      preset={track.sequencerPreset}
      activeStep={sequencer.getActiveStep()}
      synth={synth}
      sequencer={sequencer}
      sequence={currentSequence}
      onChangeSequence={handleChangeSequence}
      onPlayPause={handleClickPlayPause}
    />,
    document.getElementById("root")
  );
}
