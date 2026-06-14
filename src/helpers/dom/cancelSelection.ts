export default function cancelSelection() {
  if(window.getSelection as unknown) {
    if((window.getSelection()!.empty as unknown)) {  // Chrome
      window.getSelection()!.empty();
    } else if((window.getSelection()!.removeAllRanges as unknown)) {  // Firefox
      window.getSelection()!.removeAllRanges();
    }
    // @ts-ignore
  } else if(document.selection) {  // IE?
    // @ts-ignore
    document.selection.empty();
  }
}
