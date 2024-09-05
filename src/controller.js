class Controller {
    _keys = {};
    _callbacks = {};

    constructor(element) {
        const contextmenu = (event) => event.preventDefault();
        const onKeyDown = (event) => this.onKeyChange(event, true);
        const onKeyUp = (event) => {
            this._callbacks._onKeyUp(event.keyCode, event.shiftKey);
            this.onKeyChange(event, false);
        };

        element.addEventListener('contextmenu', contextmenu, false);
        window.addEventListener('keydown', onKeyDown, false);
        window.addEventListener('keyup', onKeyUp, false);
    }

    onKeyChange(event, pressed) {
        if (event.target === document.body) {
            this._keys[event.keyCode] = pressed;
        }
    }
}

export default Controller;
