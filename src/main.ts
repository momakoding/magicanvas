import { createApp } from "vue";
import App from "./App.vue";
import { skinTitle } from "./skin";
import "./styles.css";

document.title = skinTitle;
createApp(App).mount("#app");
