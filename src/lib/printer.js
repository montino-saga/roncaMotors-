/**
 * Printer Service for Web Serial API (ESC/POS)
 */

class PrinterService {
    constructor() {
        this.port = null;
        this.writer = null;
        this.encoder = new TextEncoder();
    }

    async connect() {
        try {
            // Request port from user
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: 9600 });
            this.writer = this.port.writable.getWriter();
            console.log("Printer connected");
            return true;
        } catch (error) {
            console.error("Connection failed:", error);
            return false;
        }
    }

    async disconnect() {
        if (this.writer) {
            await this.writer.releaseLock();
            this.writer = null;
        }
        if (this.port) {
            await this.port.close();
            this.port = null;
        }
    }

    async send(data) {
        if (!this.writer) throw new Error("Printer not connected");

        if (typeof data === 'string') {
            await this.writer.write(this.encoder.encode(data));
        } else {
            await this.writer.write(new Uint8Array(data));
        }
    }

    // ESC/POS Commands
    async init() {
        await this.send([0x1B, 0x40]); // ESC @
    }

    async openDrawer() {
        // ESC p m t1 t2
        // m = 0 (pin 2), t1 = 25, t2 = 250
        await this.send([0x1B, 0x70, 0x00, 0x19, 0xFA]);
    }

    async cut() {
        await this.send([0x1D, 0x56, 0x00]); // GS V m
    }

    async alignCenter() {
        await this.send([0x1B, 0x61, 0x01]); // ESC a 1
    }

    async alignLeft() {
        await this.send([0x1B, 0x61, 0x00]); // ESC a 0
    }

    async bold(on = true) {
        await this.send([0x1B, 0x45, on ? 0x01 : 0x00]); // ESC E n
    }

    async printReceipt(saleData) {
        if (!this.writer) return;

        try {
            await this.init();
            await this.alignCenter();
            await this.bold(true);
            await this.send("RONCAMOTORS\n");
            await this.bold(false);
            await this.send("Punto de Venta\n");
            await this.send("--------------------------------\n");

            await this.alignLeft();
            await this.send(`Fecha: ${new Date().toLocaleString()}\n`);
            await this.send(`Pago: ${saleData.tipoPago.toUpperCase()}\n`);
            await this.send("--------------------------------\n");

            for (const item of saleData.productos) {
                const name = item.nombreProducto.substring(0, 20);
                const qty = item.cantidad.toString().padStart(2);
                const price = new Intl.NumberFormat('es-CL').format(item.precioVentaLocal).padStart(8);
                await this.send(`${qty} x ${name} ${price}\n`);
            }

            await this.send("--------------------------------\n");
            await this.bold(true);
            const total = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(saleData.totalVenta);
            await this.send(`TOTAL: ${total}\n`);
            await this.bold(false);

            await this.send("\nGracias por su compra!\n\n\n\n");
            await this.cut();
            await this.openDrawer();
        } catch (error) {
            console.error("Printing failed:", error);
            throw error;
        }
    }
}

export const printer = new PrinterService();
