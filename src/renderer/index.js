import { createCanvas } from '../common';
import Point from '../vector';

const DEVELOPMENT = false;

const GL_VERTEX_SHADER = 35633;
const GL_FRAGMENT_SHADER = 35632;
const GL_ARRAY_BUFFER = 34962;
const GL_ELEMENT_ARRAY_BUFFER = 34963;
const GL_STATIC_DRAW = 35044;
const GL_DYNAMI_CDRAW = 35048;
const GL_RGBA = 6408;
const GL_UNSIGNED_BYTE = 5121;
const GL_FLOAT = 5126;
const GL_TRIANGLES = 4;
const GL_DEPTH_TEST = 2929;
const GL_LESS = 513;
const GL_LEQUAL = 515;
const GL_BLEND = 3042;
const GL_ONE = 1;
const GL_ONE_MINUS_SRC_ALPHA = 771;
const GL_COLOR_BUFFER_BIT = 16384;
const GL_DEPTH_BUFFER_BIT = 256;
const GL_TEXTURE_2D = 3553;
const GL_TEXTURE0 = 33984;
const GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL = 37441;
const GL_NEAREST = 9728;
const GL_TEXTURE_MAG_FILTER = 10240;
const GL_TEXTURE_MIN_FILTER = 10241;
const GL_MAX_TEXTURE_SIZE = 3379;

const vertexShader = `attribute vec2 g;
attribute vec2 a;
attribute vec2 t;
attribute float r;
attribute vec2 s;
attribute vec4 c;
attribute float z;
attribute vec4 u;
attribute vec4 y;
uniform mat4 m;
varying vec2 v;
varying vec2 d;
varying vec4 i;
void main(){
v=u.xy+g*u.zw;
d=y.xy+g*y.zw;
i=vec4(c.abg*c.r,c.r);
vec2 p=(g-a)*s;
float q=cos(r);
float w=sin(r);
p=vec2(p.x*q-p.y*w,p.x*w+p.y*q);
p+=a+t;
gl_Position=m*vec4(p,z,1);}`;

const fragmentShader = `precision mediump float;
uniform sampler2D x;
uniform sampler2D k;
uniform float j;
varying vec2 v;
varying vec2 d;
varying vec4 i;
void main(){
vec4 c=texture2D(x,v);
vec4 r=c*i;
if(j>0.0){
if(c.a<j)discard;
r.rgb/=r.a;
r.a=1.0;};
//vec4 m=vec4(1.0,1.0,1.0,1.0);
vec4 m=vec4(1.0);
if(d.x+d.y!=0.0){m=texture2D(k,d);};
gl_FragColor=r*m;}`;

const maxBatch = 65535;
const depth = 1e5;
const nullTexture = { t: 0 };

class Layer {
    constructor(z) {
        if (DEVELOPMENT) {
            if (!z && z !== 0) {
                throw new Error('A z parameter is required');
            }
        }

        // this.visible = true;
        this.z = z;
        this.clear();
    }

    add(...sprites) {
        sprites.forEach((sprite) => {
            sprite.remove();
            sprite.l = this;
            sprite.n = (sprite.m || sprite.a !== 1 || sprite.frame.p.a === 0 ? this.t : this.o).add(
                sprite,
            );
        });
    }

    clear() {
        this.o = new Set();
        this.t = new Set();
    }
}

const Renderer = (canvas, scale) => {
    // scale = scale || 1;

    const zeroLayer = new Layer(0);
    const sceneLayers = [zeroLayer];
    const uiLayers = [];

    const floatSize = 2 + 2 + 1 + 2 + 1 + 1 + 4 + 4;
    const byteSize = floatSize * 4;
    const arrayBuffer = new ArrayBuffer(maxBatch * byteSize);
    const floatView = new Float32Array(arrayBuffer);
    const uintView = new Uint32Array(arrayBuffer);

    /* eslint-disable no-var, vars-on-top */
    if (DEVELOPMENT) {
        var sprites;
        var drawcalls;
    }
    /* eslint-enable no-var, vars-on-top */

    const gl = canvas.getContext('webgl', {
        antialias: false,
    });

    if (DEVELOPMENT) {
        if (!gl) {
            throw new Error('WebGL not found');
        }
    }

    const ext = gl.getExtension('ANGLE_instanced_arrays');

    if (DEVELOPMENT) {
        if (!ext) {
            throw new Error('Requared ANGLE_instanced_arrays extension not found');
        }
    }

    const compileShader = (source, type) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (DEVELOPMENT) {
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const error = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                throw new Error(error);
            }
        }

        return shader;
    };

    const program = gl.createProgram();
    gl.attachShader(program, compileShader(vertexShader, GL_VERTEX_SHADER));
    gl.attachShader(program, compileShader(fragmentShader, GL_FRAGMENT_SHADER));
    gl.linkProgram(program);

    if (DEVELOPMENT) {
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(error);
        }
    }

    const createBuffer = (type, src, usage) => {
        gl.bindBuffer(type, gl.createBuffer());
        gl.bufferData(type, src, usage || GL_STATIC_DRAW);
    };

    const bindAttrib = (name, size, stride, divisor, offset, type, norm) => {
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, type || GL_FLOAT, !!norm, stride || 0, offset || 0);
        divisor && ext.vertexAttribDivisorANGLE(location, divisor);
    };

    // indicesBuffer
    createBuffer(GL_ELEMENT_ARRAY_BUFFER, new Uint8Array([0, 1, 2, 2, 1, 3]));

    // vertexBuffer
    createBuffer(GL_ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]));

    // vertexLocation
    bindAttrib('g', 2);

    // dynamicBuffer
    createBuffer(GL_ARRAY_BUFFER, arrayBuffer, GL_DYNAMI_CDRAW);

    // positionLocation
    bindAttrib('t', 2, byteSize, 1);
    // rotationLocation
    bindAttrib('r', 1, byteSize, 1, 8);
    // anchorLocation
    bindAttrib('a', 2, byteSize, 1, 12);
    // scaleLocation
    bindAttrib('s', 2, byteSize, 1, 20);
    // tintLocation
    bindAttrib('c', 4, byteSize, 1, 28, GL_UNSIGNED_BYTE, true);
    // zLocation
    bindAttrib('z', 1, byteSize, 1, 32);
    // uvsFrameLocation
    bindAttrib('u', 4, byteSize, 1, 36);
    // uvsMaskLocation
    bindAttrib('y', 4, byteSize, 1, 52);

    const maxTextureSize = gl.getParameter(GL_MAX_TEXTURE_SIZE);

    const getUniformLocation = (name) => gl.getUniformLocation(program, name);
    const matrixLocation = getUniformLocation('m');
    const textureLocation = getUniformLocation('x');
    const maskLocation = getUniformLocation('k');
    const alphaTestLocation = getUniformLocation('j');

    gl.useProgram(program);
    gl.pixelStorei(GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.enable(GL_BLEND);
    gl.blendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
    gl.enable(GL_DEPTH_TEST);

    gl.uniform1i(textureLocation, 0);
    gl.uniform1i(maskLocation, 1);

    const textures = [];

    const atlas = (alphaTest, smooth, mipmap, atlasWidth) => {
        atlasWidth = Math.min(atlasWidth || maxTextureSize, maxTextureSize);

        const border = 1;
        const [canvas, ctx] = createCanvas(atlasWidth, 1);
        const drawImage = ctx.drawImage.bind(ctx);
        const rescales = new Set();

        let canvasHeight = 1;
        let cx = 0;
        let cy = 0;
        let line = 0;
        let rebind = true;

        const p = {
            t: gl.createTexture(),
            a: alphaTest === 0 ? 0 : alphaTest || 1,
            b() {
                if (rebind) {
                    gl.bindTexture(GL_TEXTURE_2D, p.t);
                    // NEAREST || LINEAR
                    gl.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST | +smooth);
                    // NEAREST || LINEAR || NEAREST_MIPMAP_LINEAR || LINEAR_MIPMAP_LINEAR
                    gl.texParameteri(
                        GL_TEXTURE_2D,
                        GL_TEXTURE_MIN_FILTER,
                        GL_NEAREST | +smooth | (+mipmap << 8) | (+mipmap << 1),
                    );
                    gl.texImage2D(GL_TEXTURE_2D, 0, GL_RGBA, GL_RGBA, GL_UNSIGNED_BYTE, canvas);
                    mipmap && gl.generateMipmap(GL_TEXTURE_2D);

                    rebind = false;
                }
            },
        };

        textures.push(p);

        return {
            width: atlasWidth,
            frame(source, extrude, x, y, width = source.width, height = source.height) {
                if (width + border * 2 > atlasWidth - cx) {
                    cy += line;
                    cx = 0;
                    line = 0;
                }

                let multiple = 1;

                while (height + border * 2 > canvasHeight * multiple - cy) {
                    multiple *= 2;
                }

                if (DEVELOPMENT) {
                    if (canvasHeight * multiple > maxTextureSize) {
                        throw new Error('Max texture size reached.');
                    }
                }

                if (multiple > 1) {
                    const [tmp, ctx] = createCanvas(atlasWidth, canvasHeight);
                    ctx.drawImage(canvas, 0, 0);
                    canvasHeight *= multiple;
                    canvas.height = canvasHeight;
                    drawImage(tmp, 0, 0);
                    rescales.forEach((rescale) => rescale(multiple));
                }

                const fcx = cx;
                const fcy = cy;

                const redraw = (
                    source,
                    x,
                    y,
                    newWidth = source.width,
                    newHeight = source.height,
                ) => {
                    ctx.clearRect(fcx, fcy, width + border * 2, height + border * 2);

                    if (extrude) {
                        drawImage(
                            source,
                            x || 0,
                            y || 0,
                            newWidth,
                            newHeight,
                            fcx,
                            fcy,
                            width + 2,
                            height + 2,
                        );
                    }

                    // image
                    drawImage(
                        source,
                        x || 0,
                        y || 0,
                        newWidth,
                        newHeight,
                        fcx + border,
                        fcy + border,
                        width,
                        height,
                    );

                    /*
                    if (extrude) {
                        // top border
                        drawImage(
                            canvas,
                            fcx + border,
                            fcy + border,
                            width,
                            1,
                            fcx + border,
                            fcy,
                            width,
                            border,
                        );

                        // bottom border
                        drawImage(
                            canvas,
                            fcx + border,
                            fcy + height,
                            width,
                            1,
                            fcx + border,
                            fcy + height + border,
                            width,
                            border,
                        );

                        // left border
                        drawImage(
                            canvas,
                            fcx + border,
                            fcy + border,
                            1,
                            height,
                            fcx,
                            fcy + border,
                            border,
                            height,
                        );

                        // right border
                        drawImage(
                            canvas,
                            fcx + width,
                            fcy + border,
                            1,
                            height,
                            fcx + width + border,
                            fcy + border,
                            border,
                            height,
                        );

                        // top left corner
                        drawImage(
                            canvas,
                            fcx + border,
                            fcy + border,
                            1,
                            1,
                            fcx,
                            fcy,
                            border,
                            border,
                        );

                        // top right corner
                        drawImage(
                            canvas,
                            fcx + width,
                            fcy + border,
                            1,
                            1,
                            fcx + width + border,
                            fcy,
                            border,
                            border,
                        );

                        // bottom left corner
                        drawImage(
                            canvas,
                            fcx + border,
                            fcy + height,
                            1,
                            1,
                            fcx,
                            fcy + height + border,
                            border,
                            border,
                        );

                        // bottom right corner
                        drawImage(
                            canvas,
                            fcx + width,
                            fcy + height,
                            1,
                            1,
                            fcx + width + border,
                            fcy + height + border,
                            border,
                            border,
                        );
                    }
                    */

                    rebind = true;
                };

                redraw(source, x, y, width, height);

                const uvs = [
                    (cx + border) / atlasWidth,
                    (cy + border) / canvasHeight,
                    width / atlasWidth,
                    height / canvasHeight,
                ];

                rescales.add((multiple) => {
                    uvs[1] /= multiple;
                    uvs[3] /= multiple;
                });

                cx += width + border * 2;
                line = Math.max(line, height + border * 2);

                const frame = {
                    size: new Point(width, height),
                    uvs,
                    p,
                    redraw,
                    subframe(fx, fy, fw, fh) {
                        const suvs = [
                            uvs[0] + fx / atlasWidth,
                            uvs[1] + fy / canvasHeight,
                            fw / atlasWidth,
                            fh / canvasHeight,
                        ];
                        let subframeHeight = canvasHeight;

                        return {
                            size: new Point(fw, fh),
                            get uvs() {
                                if (subframeHeight !== canvasHeight) {
                                    const multiple = canvasHeight / subframeHeight;
                                    suvs[1] /= multiple;
                                    suvs[3] /= multiple;
                                    subframeHeight = canvasHeight;
                                }
                                return suvs;
                            },
                            p,
                        };
                    },
                };

                return frame;
            },
        };
    };

    let count = 0;
    let currentTexture;
    let currentMask;
    let alphaTestMode;
    let cameraAngle;

    let width;
    let height;
    let change;
    let first;

    const resize = () => {
        // width = (canvas.clientWidth * scale) | 0;
        // height = (canvas.clientHeight * scale) | 0;
        width = (canvas.clientWidth * (scale || devicePixelRatio)) | 0;
        height = (canvas.clientHeight * (scale || devicePixelRatio)) | 0;

        change = canvas.width !== width || canvas.height !== height;

        /*
		const change = canvas.width !== width || canvas.height !== height;

		if (change) {
			canvas.width = width;
			canvas.height = height;
		}
		*/

        return change;
    };

    const flush = () => {
        if (!count) return;

        if (first) {
            if (change) {
                canvas.width = width;
                canvas.height = height;
            }
            gl.viewport(0, 0, width, height);
            gl.clear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
            first = change = false;
        }

        gl.depthFunc(alphaTestMode ? GL_LESS : GL_LEQUAL);
        gl.uniform1f(alphaTestLocation, alphaTestMode ? currentTexture.a : 0);

        gl.activeTexture(GL_TEXTURE0);
        gl.bindTexture(GL_TEXTURE_2D, currentTexture.t);

        gl.activeTexture(GL_TEXTURE0 + 1);
        gl.bindTexture(GL_TEXTURE_2D, currentMask || currentTexture.t);

        gl.bufferSubData(GL_ARRAY_BUFFER, 0, floatView.subarray(0, count * floatSize));
        ext.drawElementsInstancedANGLE(GL_TRIANGLES, 6, GL_UNSIGNED_BYTE, 0, count);

        count = 0;

        /* eslint-disable block-scoped-var */
        if (DEVELOPMENT) {
            drawcalls++;
        }
        /* eslint-enable block-scoped-var */
    };

    const nullUvs = [0, 0, 0, 0];

    const draw = (sprite) => {
        if (!sprite.visible) return;

        if (count === maxBatch) flush();

        const { frame } = sprite;

        if (currentTexture.t !== frame.p.t) {
            flush();
            currentTexture = frame.p;
        }

        const mask = sprite.m;

        if (mask && currentMask !== mask.p.t) {
            flush();
            currentMask = mask.p.t;
        }

        let i = count * floatSize;

        floatView[i++] = sprite.position.x;
        floatView[i++] = sprite.position.y;

        floatView[i++] =
            sprite.position.rotation || sprite.rotation - +sprite.billboard * cameraAngle;

        floatView[i++] = sprite.anchor.x;
        floatView[i++] = sprite.anchor.y;

        floatView[i++] = sprite.scale.x * frame.size.x;
        floatView[i++] = sprite.scale.y * frame.size.y;

        uintView[i++] = (((sprite.tint & 0xffffff) << 8) | ((sprite.a * 255) & 255)) >>> 0;
        floatView[i++] = sprite.l.z;

        floatView.set(frame.uvs, i);
        floatView.set(mask ? mask.uvs : nullUvs, i + 4);

        count++;

        /* eslint-disable block-scoped-var */
        if (DEVELOPMENT) {
            sprites++;
        }
        /* eslint-enable block-scoped-var */
    };

    const getLayer = (ls, z) => {
        let l = ls.find((layer) => layer.z === z);

        if (!l) {
            l = new Layer(z);
            ls.push(l);
            ls.sort((a, b) => b.z - a.z);
        }

        /*
		const l = new Layer(z);
		ls.push(l);
		ls.sort((a, b) => b.z - a.z);
		*/

        return l;
    };

    const renderer = {
        gl,

        atlas,

        get width() {
            return width;
        },

        get height() {
            return height;
        },

        camera: {
            at: new Point(),
            to: new Point(), // 0 -> 1
            angle: 0,
        },

        background(r, g, b, a = 1) {
            gl.clearColor(r * a, g * a, b * a, a);
        },

        layer: getLayer.bind(null, sceneLayers),

        ui: getLayer.bind(null, uiLayers),

        add(sprite) {
            zeroLayer.add(sprite);
        },

        resize,

        /* eslint-disable-next-line consistent-return */
        render() {
            /* eslint-disable no-var, vars-on-top, block-scoped-var */
            if (DEVELOPMENT) {
                var begin = (performance || Date).now();
                sprites = 0;
                drawcalls = 0;
            }
            /* eslint-enable no-var, vars-on-top, block-scoped-var */

            !change && resize();
            first = true;

            // gl.viewport(0, 0, width, height);
            // gl.clear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

            textures.forEach((texture) => texture.b());

            currentTexture = nullTexture;
            currentMask = 0;

            const { at, to, angle } = renderer.camera;

            const x = at.x - width * to.x;
            const y = at.y - height * to.y;

            const c = Math.cos(angle);
            const s = Math.sin(angle);

            const w = 2 / width;
            const h = -2 / height;

            /*

			|   1 |    0| 0| 0|
			|   0 |    1| 0| 0|
			|   0 |    0| 1| 0|
			| at.x| at.y| 0| 1|

			x

			|  c| s| 0| 0|
			| -s| c| 0| 0|
			|  0| 0| 1| 0|
			|  0| 0| 0| 1|

			x

			|     1|     0| 0| 0|
			|     0|     1| 0| 0|
			|     0|     0| 1| 0|
			| -at.x| -at.y| 0| 1|

			x

			|     2/width|           0|        0| 0|
			|           0|   -2/height|        0| 0|
			|           0|           0| -1/depth| 0|
			| -2x/width-1| 2y/height+1|        0| 1|

			*/

            // prettier-ignore
            const sceneProjection = [
				c * w, s * h, 0, 0,
				-s * w, c * h, 0, 0,
				0, 0, -1 / depth, 0,

				(at.x * (1 - c) + at.y * s) * w - 2 * x / width - 1,
				(at.y * (1 - c) - at.x * s) * h + 2 * y / height + 1,
				0, 1
			];

            // prettier-ignore
            const uiProjection = [
				w, 0, 0, 0,
				0, h, 0, 0,
				0, 0, -1 / depth, 0,
				-1, 1, 0, 1
			];

            [true, false].forEach((atm) => {
                alphaTestMode = atm;
                (atm ? [uiLayers, sceneLayers] : [sceneLayers, uiLayers]).forEach((layers) => {
                    gl.uniformMatrix4fv(
                        matrixLocation,
                        false,
                        layers === uiLayers ? uiProjection : sceneProjection,
                    );

                    cameraAngle = layers === uiLayers ? 0 : angle;

                    if (atm) {
                        // layers.forEach(layer => layer.o.i(draw));
                        const { length } = layers;
                        for (let l = 0; l < length; l++) {
                            layers[l].o.forEach(draw);
                        }
                    } else {
                        for (let l = layers.length - 1; l >= 0; l--) {
                            layers[l].t.forEach(draw);
                        }
                    }

                    flush();
                });
            });

            /* eslint-disable block-scoped-var */
            if (DEVELOPMENT) {
                return {
                    time: (performance || Date).now() - begin,
                    sprites,
                    drawcalls,
                };
            }
            /* eslint-enable block-scoped-var */
        },
    };

    resize();

    return renderer;
};

Renderer.anchor = new Point();

// Renderer.Point = Point;

Renderer.Sprite = class Sprite {
    constructor(frame, props) {
        if (DEVELOPMENT) {
            if (!frame) {
                throw new Error('A frame parameter is required');
            }
        }

        Object.assign(
            this,
            {
                frame,
                visible: true,
                billboard: false,
                position: new Point(),
                rotation: 0,
                anchor: new Point().from(Renderer.anchor),
                scale: new Point(1),
                tint: 0xffffff,
                m: null,
                a: 1,
                l: null,
                n: null,
            },
            props,
        );
    }

    get alpha() {
        return this.a;
    }

    set alpha(value) {
        if (DEVELOPMENT) {
            if (value < 0 || value > 1) {
                throw new Error('An alpha of a sprite should be in the range from 0 to 1.');
            }
        }

        const change = (value < 1 && this.a === 1) || (value === 1 && this.a < 1);
        this.a = value;
        change && this.frame.p.a > 0 && this.l && this.l.add(this);
    }

    get mask() {
        return this.m;
    }

    set mask(value) {
        this.m = value;
        this.l && this.l.add(this);
    }

    remove() {
        this.n && this.n.delete(this);
        this.n = null;
        this.l = null;
    }
};

export default Renderer;
