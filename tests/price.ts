import * as anchor from "@coral-xyz/anchor"
import { Keypair, PublicKey } from "@solana/web3.js"
import { assert, expect } from 'chai'
import { AccountClient, AnchorError, parseIdlErrors, Program } from "@coral-xyz/anchor"
import { PaywallOnchain } from "../target/types/paywall_onchain"
import { BaseState } from "./base_state"

type KP = anchor.web3.Keypair

export function getPricePda(program: Program<PaywallOnchain>): PublicKey {
    const [pda, _] = PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("price_state"),
        ],
        program.programId,
    )
    return pda
}

export async function initPrice(program: Program<PaywallOnchain>, authority: Keypair): Promise<PriceState> {
    const provider = program.provider as anchor.AnchorProvider

    let pricePda = getPricePda(program)

    const pdaInfo = await provider.connection.getAccountInfo(pricePda)
    if (pdaInfo == null) {
        await program.methods
            .initialize()
            .accounts({
                priceState: pricePda,
                authority: authority.publicKey, 
            })
            .signers([authority])
            .rpc()
    }

    return PriceState.createPda(program, pricePda)
}

export async function updatePrice(state: PriceState, authority: Keypair, newPrice: Number) {
    let program = state.program;
    const programProvider = program.provider as anchor.AnchorProvider;

    await program.methods
        .updatePrice(new anchor.BN(newPrice))
        .accounts({
            priceAccount: state.getPubKey(),
            programAuthority: authority.publicKey,
        })
        .signers([authority])
        .rpc();
}

export class PriceState extends BaseState<PriceState> {

    price: number

    public static async createPda(program: Program<PaywallOnchain>, publicKey: PublicKey): Promise<PriceState> {
        return new PriceState(program, null, 'PriceState', publicKey)
            .refresh()
    }

    async refresh(): Promise<PriceState> {
        let remoteState = await this.program.account.priceState.fetch(this.getPubKey())
        console.log(`PriceState.refresh: ${this.getPubKey()}`)
        this.price = remoteState.price.toNumber()
        console.log(`PriceState fetched auth value: ${remoteState.authority}`)
        return this
    }

    toString(): string {
        return `${this.instanceName}(${this.price}, ${this.getPubKeyStr()})`
    }
}

