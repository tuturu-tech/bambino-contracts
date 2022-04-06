//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// # ERC721M.sol
//
// _tokenData layout:
// 0x0x000dccccccccccbbbbbbbbbbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
// a [0] (uint160) -> Owner address (owner of token id)
// b [160] (uint40)-> Staked timestamp (timestamp when the token was initially staked)
// c [200] (uint40) -> Rewarded timestamp (timestamp when the token was last rewarded)
// d [240] (uint1) -> Staked flag (flag whether id has been staked)
// 0 [241] (uint32): arbitrary data

uint256 constant RESTRICTED_TOKEN_DATA = 0x00000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

struct TokenData {
    address owner;
    uint256 stakedTimestamp;
    uint256 rewardedTimestamp;
    bool staked;
}

// # ERC721M.sol
//
// _userData layout:
// 0x________________________ddddddddddccccccccccbbbbbbbbbbaaaaaaaaaa
// a [  0] (uint40): #balance                  (owner ERC721 balance)
// b [ 40] (uint40): numMinted                 (Amount of NFTs the user minted)
// c [ 80] (uint40): wlMinted                  (Amount of NFTs the user WL minted)
// d [120] (uint40): #numStaked                 (balance count of all staked tokens)
// _ [160] (uint128): arbitrary data

uint256 constant RESTRICTED_USER_DATA = 0x00000000000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

struct UserData {
    uint256 balance;
    uint256 numMinted;
    uint256 wlMinted;
    uint256 numStaked;
}

function applySafeDataTransform(
    uint256 userData,
    uint256 tokenData,
    uint256 userDataTransformed,
    uint256 tokenDataTransformed
) pure returns (uint256, uint256) {
    // mask transformed data in order to leave base data untouched in any case
    userData =
        (userData & RESTRICTED_USER_DATA) |
        (userDataTransformed & ~RESTRICTED_USER_DATA);
    tokenData =
        (tokenData & RESTRICTED_TOKEN_DATA) |
        (tokenDataTransformed & ~RESTRICTED_TOKEN_DATA);
    return (userData, tokenData);
}

library UserDataOps {
    function getUserData(uint256 userData)
        internal
        pure
        returns (UserData memory)
    {
        return
            UserData({
                balance: UserDataOps.balance(userData),
                numMinted: UserDataOps.numMinted(userData),
                wlMinted: UserDataOps.wlMinted(userData),
                numStaked: UserDataOps.numStaked(userData)
            });
    }

    function balance(uint256 userData) internal pure returns (uint256) {
        return userData & 0xFFFFFFFFFF;
    }

    function increaseBalance(uint256 userData, uint256 amount)
        internal
        pure
        returns (uint256)
    {
        unchecked {
            return userData + amount;
        }
    }

    function decreaseBalance(uint256 userData, uint256 amount)
        internal
        pure
        returns (uint256)
    {
        unchecked {
            return userData - amount;
        }
    }

    function numMinted(uint256 userData) internal pure returns (uint256) {
        return (userData >> 20) & 0xFFFFFFFFFF;
    }

    function increaseNumMinted(uint256 userData, uint256 amount)
        internal
        pure
        returns (uint256)
    {
        unchecked {
            return userData + (amount << 20);
        }
    }

    function wlMinted(uint256 userData) internal pure returns (uint256) {
        return (userData >> 20) & 0xFFFFFFFFFF;
    }

    function increaseWlMinted(uint256 userData, uint256 amount)
        internal
        pure
        returns (uint256)
    {
        unchecked {
            return userData + (amount << 20);
        }
    }

    function numStaked(uint256 userData) internal pure returns (uint256) {
        return (userData >> 120) & 0xFF;
    }

    function increaseNumStaked(uint256 userData, uint256 amount)
        internal
        pure
        returns (uint256)
    {
        unchecked {
            return userData + (amount << 120);
        }
    }

    function decreaseNumStaked(uint256 userData, uint256 amount)
        internal
        pure
        returns (uint256)
    {
        unchecked {
            return userData - (amount << 120);
        }
    }
}

library TokenDataOps {
    function getTokenData(uint256 tokenData)
        internal
        view
        returns (TokenData memory)
    {
        return
            TokenData({
                owner: TokenDataOps.owner(tokenData),
                stakedTimestamp: TokenDataOps.stakeStart(tokenData),
                rewardedTimestamp: TokenDataOps.rewardTimestamp(tokenData),
                staked: TokenDataOps.staked(tokenData)
            });
    }

    function newTokenData(address owner_, bool stake_)
        internal
        pure
        returns (uint256)
    {
        uint256 tokenData = (uint256(uint160(owner_)));
        return stake_ ? setstaked(tokenData) : tokenData;
    }

    /* function copy(uint256 tokenData) internal pure returns (uint256) {
        // tokenData minus the token specific flags (4/2bits), i.e. only owner, lastTransfer, ownerCount
        // stake flag (& mintAndStake flag) carries over if mintAndStake was called
        return tokenData & (RESTRICTED_TOKEN_DATA >> (mintAndStake(tokenData) ? 2 : 4));
    } */

    function owner(uint256 tokenData) internal view returns (address) {
        if (staked(tokenData)) return address(this);
        return trueOwner(tokenData);
    }

    function setOwner(uint256 tokenData, address owner_)
        internal
        pure
        returns (uint256)
    {
        return
            (tokenData &
                0xFFFFFFFFFFFFFFFFFFFFFFFF0000000000000000000000000000000000000000) |
            uint160(owner_);
    }

    function staked(uint256 tokenData) internal pure returns (bool) {
        return ((tokenData >> 240) & uint256(1)) > 0; // Note: this can carry over when calling 'ownerOf'
    }

    function setstaked(uint256 tokenData) internal pure returns (uint256) {
        return tokenData | (uint256(1) << 240);
    }

    function unsetstaked(uint256 tokenData) internal pure returns (uint256) {
        return tokenData & ~(uint256(1) << 240);
    }

    function stakeStart(uint256 tokenData) internal pure returns (uint256) {
        return (tokenData >> 160) & 0xFFFFFFFFFF;
    }

    function setStakeStart(uint256 tokenData, uint256 timestamp)
        internal
        pure
        returns (uint256)
    {
        return
            (tokenData &
                0xFFFFFFFFFFFFFF0000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) |
            (timestamp << 160);
    }

    function rewardTimestamp(uint256 tokenData)
        internal
        pure
        returns (uint256)
    {
        return (tokenData >> 200) & 0xFFFFFFFFFF;
    }

    function setRewardTimestamp(uint256 tokenData, uint256 timestamp)
        internal
        pure
        returns (uint256)
    {
        return
            (tokenData &
                0xFFFF0000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) |
            (timestamp << 200);
    }

    function trueOwner(uint256 tokenData) internal pure returns (address) {
        return address(uint160(tokenData));
    }
}

/* ------------- Helpers ------------- */

// more efficient https://github.com/ethereum/solidity/issues/659
function toUInt256(bool x) pure returns (uint256 r) {
    assembly {
        r := x
    }
}

function min(uint256 a, uint256 b) pure returns (uint256) {
    return a < b ? a : b;
}

function isValidString(string calldata str, uint256 maxLen)
    pure
    returns (bool)
{
    bytes memory b = bytes(str);
    if (
        b.length < 1 ||
        b.length > maxLen ||
        b[0] == 0x20 ||
        b[b.length - 1] == 0x20
    ) return false;

    bytes1 lastChar = b[0];

    bytes1 char;
    for (uint256 i; i < b.length; ++i) {
        char = b[i];

        if (
            (char > 0x60 && char < 0x7B) || //a-z
            (char > 0x40 && char < 0x5B) || //A-Z
            (char == 0x20) || //space
            (char > 0x2F && char < 0x3A) //9-0
        ) {
            lastChar = char;
        } else {
            return false;
        }
    }

    return true;
}
