const helpers = require("./helpers");
const constants = require("./constants");
const Avatar = artifacts.require("./Avatar.sol");
const DAOToken = artifacts.require("./DAOToken.sol");
const ActorsFactory = artifacts.require("./ActorsFactory.sol");
const StandardTokenMock = artifacts.require("./test/StandardTokenMock.sol");
const ActionMock = artifacts.require("./test/ActionMock.sol");
const SchemeMock = artifacts.require("./test/SchemeMock.sol");

let avatar;
var avatarLibrary, daoTokenLibrary, actorsFactory;

const setup = async function(accounts) {
  avatarLibrary = await Avatar.new({ gas: constants.ARC_GAS_LIMIT });
  daoTokenLibrary = await DAOToken.new({ gas: constants.ARC_GAS_LIMIT });

  actorsFactory = await ActorsFactory.new(
    avatarLibrary.address,
    daoTokenLibrary.address,
    { gas: constants.ARC_GAS_LIMIT }
  );

  avatar = await Avatar.at(
    (await actorsFactory.createAvatar("0x1234", accounts[0], accounts[1]))
      .logs[0].args.newAvatarAddress
  );

  return avatar;
};

contract("Avatar", accounts => {
  it("genericCall no owner", async () => {
    avatar = await setup(accounts);
    let actionMock = await ActionMock.new();
    var scheme = await SchemeMock.new();
    let a = 7;
    let b = actionMock.address;
    let c = "0x1234";
    try {
      await scheme.genericCallDirect.call(
        avatar.address,
        actionMock.address,
        a,
        b,
        c,
        { from: accounts[1] }
      );
      assert(false, "genericAction should fail due to wrong owner");
    } catch (ex) {
      helpers.assertVMException(ex);
    }
  });

  it("generic call", async () => {
    avatar = await setup(accounts);
    let actionMock = await ActionMock.new();
    var scheme = await SchemeMock.new();
    await avatar.transferOwnership(scheme.address);
    let a = 7;
    let b = actionMock.address;
    let c = "0x1234";
    var result = await scheme.genericCallDirect.call(
      avatar.address,
      actionMock.address,
      a,
      b,
      c
    );
    assert.equal(result, a * 2);
  });

  it("generic call should revert if action revert", async () => {
    avatar = await setup(accounts);
    let actionMock = await ActionMock.new();
    var scheme = await SchemeMock.new();
    await avatar.transferOwnership(scheme.address);
    let a = 7;
    let b = actionMock.address;
    let c = "0x4567"; //the action test function require 0x1234
    try {
      await scheme.genericCallDirect.call(
        avatar.address,
        actionMock.address,
        a,
        b,
        c
      );
      assert(false, "generic call should revert if action revert ");
    } catch (ex) {
      helpers.assertVMException(ex);
    }
  });

  it("pay ether to avatar", async () => {
    avatar = await setup(accounts);
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: avatar.address,
      value: web3.utils.toWei("1", "ether")
    });
    var avatarBalance =
      (await web3.eth.getBalance(avatar.address)) /
      web3.utils.toWei("1", "ether");
    assert.equal(avatarBalance, 1);
  });

  it("sendEther from ", async () => {
    avatar = await setup(accounts);
    var otherAvatar = await Avatar.at(
      (await actorsFactory.createAvatar(
        "otheravatar",
        helpers.NULL_ADDRESS,
        helpers.NULL_ADDRESS
      )).logs[0].args.newAvatarAddress
    );
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: avatar.address,
      value: web3.utils.toWei("1", "ether")
    });
    var avatarBalance =
      (await web3.eth.getBalance(avatar.address)) /
      web3.utils.toWei("1", "ether");
    assert.equal(avatarBalance, 1);
    var tx = await avatar.sendEther(
      web3.utils.toWei("1", "ether"),
      otherAvatar.address
    );
    assert.equal(tx.logs.length, 2);
    assert.equal(tx.logs[1].event, "SendEther");
    avatarBalance =
      (await web3.eth.getBalance(avatar.address)) /
      web3.utils.toWei("1", "ether");
    assert.equal(avatarBalance, 0);
    var otherAvatarBalance =
      (await web3.eth.getBalance(otherAvatar.address)) /
      web3.utils.toWei("1", "ether");
    assert.equal(otherAvatarBalance, 1);
  });

  it("externalTokenTransfer  ", async () => {
    avatar = await setup(accounts);
    var standardToken = await StandardTokenMock.new(avatar.address, 100);
    let balanceAvatar = await standardToken.balanceOf(avatar.address);
    assert.equal(balanceAvatar, 100);
    var tx = await avatar.externalTokenTransfer(
      standardToken.address,
      accounts[1],
      50
    );
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, "ExternalTokenTransfer");
    balanceAvatar = await standardToken.balanceOf(avatar.address);
    assert.equal(balanceAvatar, 50);
    let balance1 = await standardToken.balanceOf(accounts[1]);
    assert.equal(balance1, 50);
  });

  it("externalTokenTransferFrom & externalTokenIncreaseApproval", async () => {
    var tx;
    var to = accounts[1];
    avatar = await setup(accounts);
    var standardToken = await StandardTokenMock.new(avatar.address, 100);
    tx = await avatar.externalTokenIncreaseApproval(
      standardToken.address,
      avatar.address,
      50
    );
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, "ExternalTokenIncreaseApproval");
    tx = await avatar.externalTokenTransferFrom(
      standardToken.address,
      avatar.address,
      to,
      50
    );
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, "ExternalTokenTransferFrom");
    let balanceAvatar = await standardToken.balanceOf(avatar.address);
    assert.equal(balanceAvatar, 50);
    let balanceTo = await standardToken.balanceOf(to);
    assert.equal(balanceTo, 50);
  });

  it("externalTokenTransferFrom & externalTokenDecreaseApproval", async () => {
    var tx;
    var to = accounts[1];
    avatar = await setup(accounts);
    var standardToken = await StandardTokenMock.new(avatar.address, 100);
    tx = await avatar.externalTokenIncreaseApproval(
      standardToken.address,
      avatar.address,
      50
    );
    tx = await avatar.externalTokenDecreaseApproval(
      standardToken.address,
      avatar.address,
      50
    );
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, "ExternalTokenDecreaseApproval");
    try {
      await avatar.externalTokenTransferFrom(
        standardToken.address,
        avatar.address,
        to,
        50
      );
      assert(
        false,
        "externalTokenTransferFrom should fail due to decrease approval "
      );
    } catch (ex) {
      helpers.assertVMException(ex);
    }
    tx = await avatar.externalTokenIncreaseApproval(
      standardToken.address,
      avatar.address,
      50
    );
    tx = await avatar.externalTokenTransferFrom(
      standardToken.address,
      avatar.address,
      to,
      50
    );
    assert.equal(tx.logs.length, 1);
    assert.equal(tx.logs[0].event, "ExternalTokenTransferFrom");
    let balanceAvatar = await standardToken.balanceOf(avatar.address);
    assert.equal(balanceAvatar, 50);
    let balanceTo = await standardToken.balanceOf(to);
    assert.equal(balanceTo, 50);
  });
});
