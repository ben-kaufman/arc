pragma solidity ^0.4.24;


contract ExternalTokenLockerMock {

    // user => amount
    mapping (address => uint) public lockedTokenBalances;

    function lock(uint _amount) public {
        lockedTokenBalances[msg.sender] = _amount;
    }
}
