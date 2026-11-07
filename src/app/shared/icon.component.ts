import { Component, input } from "@angular/core";
const paths: Record<string, string> = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  accounts:
    "M3 21V7l9-4 9 4v14 M8 21v-5h8v5 M7 9h2 M15 9h2 M7 12h2 M15 12h2 M1 21h22",
  box: "m12 3 9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9 M7.5 5.5l9 5",
  orders: "M8 3H5v18h14V3h-3 M8 2h8v4H8z M8 10h8 M8 14h8 M8 18h4",
  upload: "M12 16V3 m-5 5 5-5 5 5 M4 16v5h16v-5",
  users:
    "M15 21v-3a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v3 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 7 M21 21v-3a4 4 0 0 0-4-4",
  link: "m10 13 4-4 M9 15l-2 2a4 4 0 0 1-5-6l4-4a4 4 0 0 1 6 0 M12 17a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1",
  shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z m-4 10 3 3 5-6",
  arrow: "M4 12h16 m-6-6 6 6-6 6",
  external: "M14 3h7v7 M21 3 10 14 M10 3H3v18h18v-7",
  refresh:
    "M20 7a9 9 0 0 0-15-2L2 8 m0-6v6h6 M4 17a9 9 0 0 0 15 2l3-3 m0 6v-6h-6",
  check: "m5 12 4 4L19 6",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 11v6 M12 7h.01",
  alert: "m12 3 10 18H2z M12 9v5 M12 17h.01",
  close: "m6 6 12 12 M6 18 18 6",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 m5 12 6 6",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  logout: "M10 3H3v18h7 M8 12h13 m-5-5 5 5-5 5",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6v6l4 2",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
};
@Component({
  selector: "app-icon",
  standalone: true,
  host: {
    "aria-hidden": "true",
    "[style.width.px]": "size()",
    "[style.height.px]": "size()",
  },
  styles:
    ":host {display:inline-flex;flex-shrink:0;} svg {width:100%;height:100%;}",
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path [attr.d]="path()" /></svg>',
})
export class IconComponent {
  readonly name = input("grid");
  readonly size = input(20);
  path(): string {
    return paths[this.name()] || paths["grid"];
  }
}
