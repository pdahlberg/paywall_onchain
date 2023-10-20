import * as anchor from "@coral-xyz/anchor"
import { PublicKey } from "@solana/web3.js"
import { Program } from "@coral-xyz/anchor"
import { PaywallOnchain } from "../target/types/paywall_onchain"

type KP = anchor.web3.Keypair

export class BaseState<T> {
    readonly program: Program<PaywallOnchain>
    readonly keyPair: KP
    readonly publicKey: anchor.web3.PublicKey
    instanceName: string
    initialized: boolean = false

    constructor(program: Program<PaywallOnchain>, keyPair: KP, instanceName: string, publicKey: PublicKey = null) {
        this.program = program
        this.keyPair = keyPair
        this.publicKey = keyPair?.publicKey ?? publicKey
        this.instanceName = instanceName
    }

    getPubKey(): PublicKey {
        return this.publicKey
    }

    getPubKeyStr(): string {
        return this.getPubKey().toBase58()
    }

    toString(): string {
        return `${this.instanceName}()`
    }

    log(prefix: number = null): this {
        let str = (prefix == null ? ">" : prefix + ": ")
        console.log(str, this.toString())
        return this
    }

    withName(instanceName: string): this {
        this.instanceName = instanceName
        return this
    }
}
