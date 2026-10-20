<script setup>
const trees = [
  ...[0, 64, 128, 192, 256, 320, 704, 768, 832, 896, 960, 1024, 1080].map((x) => ({ x, y: 0 })),
  ...[0, 64, 320, 384, 448, 512, 576, 640, 896, 960, 1024, 1080].map((x) => ({ x, y: 720 })),
  ...[72, 144, 248, 552, 624].flatMap((y) => [
    { x: 0, y },
    { x: 1056, y },
  ]),
  { x: 352, y: 92 },
  { x: 704, y: 140 },
  { x: 648, y: 560 },
  { x: 352, y: 500 },
]
const bushes = [
  { x: 112, y: 310 },
  { x: 288, y: 310 },
  { x: 448, y: 248 },
  { x: 672, y: 264 },
  { x: 968, y: 352 },
  { x: 80, y: 600 },
  { x: 624, y: 704 },
  { x: 944, y: 664 },
]
const cousins = [
  { name: 'Mochi', x: 352, y: 280, scarf: 'mint' },
  { name: 'Maple', x: 652, y: 204, scarf: 'peach' },
  { name: 'Pebble', x: 496, y: 412, scarf: 'blue' },
  { name: 'Clover', x: 352, y: 636, scarf: 'mint' },
  { name: 'Biscuit', x: 970, y: 584, scarf: 'peach' },
]
</script>
<template>
  <div class="town-scenery" aria-hidden="true">
    <svg
      class="town-paths"
      width="1120"
      height="800"
      viewBox="0 0 1120 800"
      shape-rendering="crispEdges"
    >
      <g fill="#c2a66b">
        <path
          d="M184 248h80v80h272V208h80v120h272v-48h80v128H568v256h208v-40h80v104H200v-104h80v40h208V408H184Z"
        />
      </g>
      <g fill="#e6cb92">
        <path
          d="M192 256h64v80h288V216h64v120h288v-48h64v112H560v272h224v-40h64v88H208v-88h64v40h224V400H192Z"
        />
      </g>
      <g fill="#d5b879">
        <path
          d="M200 352h24v4h-24Zm104 18h16v4h-16Zm164-19h20v4h-20Zm192 28h24v4h-24Zm216-22h20v4h-20ZM520 466h16v4h-16Zm-8 92h24v4h-24Zm-176 132h24v4h-24Zm280 9h16v4h-16Z"
        />
      </g>
      <path d="M440 330h176v112H440Z" fill="#bfa879" />
      <path d="M448 338h160v96H448Z" fill="#efdaa6" />
      <path
        d="M452 342h152v4H452Zm0 40h152v4H452Zm0 40h152v4H452ZM480 346h4v36h-4Zm52 0h4v36h-4Zm52 0h4v36h-4ZM460 386h4v36h-4Zm52 0h4v36h-4Zm52 0h4v36h-4Z"
        fill="#d8c192"
      />
    </svg>
    <div class="town-pond"><span></span><i></i></div>
    <div class="town-flowerbed flowers-west"></div>
    <div class="town-flowerbed flowers-east"></div>
    <div class="town-bench bench-west"></div>
    <div class="town-bench bench-east"></div>
    <div class="town-sign">
      <span>SHARLOCK<br />TOWN</span>
    </div>
    <img
      v-for="(tree, index) in trees"
      :key="`tree-${index}`"
      class="pixel-tree"
      src="/images/town/tree.svg"
      width="64"
      height="80"
      alt=""
      :style="{ left: `${tree.x}px`, top: `${tree.y}px` }"
    />
    <img
      v-for="(bush, index) in bushes"
      :key="`bush-${index}`"
      class="pixel-bush"
      src="/images/town/bush.svg"
      width="64"
      height="40"
      alt=""
      :style="{ left: `${bush.x}px`, top: `${bush.y}px` }"
    />
    <div
      v-for="cousin in cousins"
      :key="cousin.name"
      class="capybara-npc"
      :style="{ left: `${cousin.x}px`, top: `${cousin.y}px` }"
    >
      <img
        :src="`/images/town/capybara-${cousin.scarf}.svg`"
        width="64"
        height="48"
        alt=""
      /><span>{{ cousin.name }}</span>
    </div>
    <span class="town-welcome-sign">EVERY DOOR IS OPEN</span>
  </div>
</template>
