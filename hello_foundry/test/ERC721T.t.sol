// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {DSTestPlus} from "solmate/test/utils/DSTestPlus.sol";
import {Vm} from "forge-std/Vm.sol";
import {console} from "forge-std/console.sol";

import "ds-test/test.sol";
import "forge-std/Test.sol";
import "../src/libs/ERC721T.sol";
import "../src/Bambinos.sol";
import "../src/Vial.sol";
import "../src/BambinoBox.sol";

contract ERC721TTest is DSTestPlus {
    Vm vm = Vm(HEVM_ADDRESS);

    address alice = address(0xbabe);
    address bob = address(0xb0b);
    address chris = address(0xc8414);
    address tester = address(this);

    BillionaireBambinos bambino;
    Vial vial;
    BambinoBox box;

    function setUp() public {
        vial = new Vial("vialURI", tester);
        box = new BambinoBox("boxURI", tester);
        bambino = new BillionaireBambinos(address(box), address(vial), 1234);

        vial.setBBContract(address(bambino));
        box.setApprovedMinter(address(bambino));

        vm.label(alice, "Alice");
        vm.label(bob, "Bob");
        vm.label(chris, "Chris");

        vm.label(tester, "Tester");
        vm.label(address(bambino), "Bambino");
        vm.label(address(vial), "Vial");
        vm.label(address(box), "Box");

        vial.toggleSale();
        box.togglePaused();
        bambino.toggleActive();

        vm.deal(alice, 100 ether);
    }

    function test_approvedContracts() public {
        assertEq(vial.BBContract(), address(bambino));
        assertEq(box.approvedMinter(), address(bambino));
        assertEq(address(bambino.vialContract()), address(vial));
        assertEq(address(bambino.bambinoBox()), address(box));
    }

    /* ------------- stake() ------------- */
    function test_stakeUnstake() public {
        vm.startPrank(alice, alice);

        vial.mint{value: vial.price()}(1);

        assertEq(vial.ownerOfERC721Like(1), address(alice));

        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;
        bambino.burnVialsForBambino(ids);

        vm.expectRevert("ERC1155D: owner query for nonexistent token");
        vial.ownerOfERC721Like(1);

        bambino.stake(ids);

        assertEq(bambino.balanceOf(alice), 0);
        assertEq(bambino.numMinted(alice), 1);
        assertEq(bambino.numStaked(alice), 1);

        assertEq(bambino.ownerOf(1), address(bambino));
        assertEq(bambino.trueOwnerOf(1), alice);

        bambino.unstake(ids);

        assertEq(bambino.balanceOf(alice), 1);
        assertEq(bambino.numMinted(alice), 1);
        assertEq(bambino.numStaked(alice), 0);

        assertEq(bambino.ownerOf(1), alice);
        assertEq(bambino.trueOwnerOf(1), alice);
        vm.stopPrank();
    }

    function test_stakeUnstakeMany() public {
        vm.startPrank(alice, alice);
        uint256 mintNum = 10;
        vial.mint{value: vial.price() * mintNum}(mintNum);

        uint256[] memory mintIds = new uint256[](mintNum);
        for (uint256 i; i < mintNum; i++) {
            mintIds[i] = i + 1;
            assertEq(vial.ownerOfERC721Like(i + 1), address(alice));
        }

        bambino.burnVialsForBambino(mintIds);

        uint256[] memory ids = new uint256[](3);
        ids[0] = 3;
        ids[1] = 4;
        ids[2] = 7;

        bambino.stake(ids);

        assertEq(bambino.balanceOf(alice), 7);
        assertEq(bambino.numMinted(alice), 10);
        assertEq(bambino.numStaked(alice), 3);

        assertEq(bambino.ownerOf(1), alice);
        assertEq(bambino.ownerOf(2), alice);
        assertEq(bambino.ownerOf(3), address(bambino));
        assertEq(bambino.ownerOf(4), address(bambino));
        assertEq(bambino.ownerOf(5), alice);
        assertEq(bambino.ownerOf(6), alice);
        assertEq(bambino.ownerOf(7), address(bambino));
        assertEq(bambino.ownerOf(8), alice);
        assertEq(bambino.ownerOf(9), alice);
        assertEq(bambino.ownerOf(10), alice);

        for (uint256 i; i < 10; ++i)
            assertEq(bambino.trueOwnerOf(i + 1), alice);

        bambino.unstake(ids);

        for (uint256 i; i < 10; ++i) assertEq(bambino.ownerOf(i + 1), alice);
        for (uint256 i; i < 10; ++i)
            assertEq(bambino.trueOwnerOf(i + 1), alice);
        vm.stopPrank();
    }

    /* ------------- mint() ------------- */
    function test_vialMint() public {
        vm.startPrank(alice, alice);

        vial.mint{value: vial.price()}(1);

        assertEq(vial.ownerOfERC721Like(1), address(alice));
        vm.stopPrank();
    }

    function test_vialMintTen() public {
        vm.startPrank(alice, alice);

        uint256 mintNum = 10;
        vial.mint{value: vial.price() * mintNum}(mintNum);

        for (uint256 i; i < mintNum; i++) {
            assertEq(vial.ownerOfERC721Like(i + 1), address(alice));
        }
        vm.stopPrank();
    }

    /* function test_mint_fail_CallerIsContract() public {
        vm.startPrank(alice, tester);
        vm.expectRevert("CALLER_IS_CONTRACT");
        vial.mint{value: vial.price()}(1);
    } */
}
