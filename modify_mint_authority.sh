MY_ADDRESS=87AT56xPtYs3yracfWKJ8trTpeahKQY2nTQVSMAsH3J5 #replace with address of earlier generated keypair (id.json)

# Make ourselves the mint authority
# Replace the mint authority 2wmVCSfPxGPjrnMMn7rchp4uaeoTqN39mXFC2zhPdri9 (M. Allair multisig) with our solana address
# or 32 bytes at index 4
#
# Ugly "One" liner because i don't know how to do this in any other way

# BSOL
python3 -c "import base64;import base58;import json;bsol = json.load(open('./clones/bsol.json'));data = bytearray(base64.b64decode(bsol['account']['data'][0]));data[4:4+32] = base58.b58decode('${MY_ADDRESS}');print(base64.b64encode(data));bsol['account']['data'][0] = base64.b64encode(data).decode('utf8');json.dump(bsol, open('./clones/bsol_clone.json', 'w'))"
set -e solana-test-validator --account bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1 ./clones/bsol_clone.json --reset &

# USDC
python3 -c "import base64;import base58;import json;usdc = json.load(open('./clones/usdc.json'));data = bytearray(base64.b64decode(usdc['account']['data'][0]));data[4:4+32] = base58.b58decode('${MY_ADDRESS}');print(base64.b64encode(data));usdc['account']['data'][0] = base64.b64encode(data).decode('utf8');json.dump(usdc, open('./clones/usdc_clone.json', 'w'))"
set -e solana-test-validator --account EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v ./clones/usdc_clone.json --reset &
