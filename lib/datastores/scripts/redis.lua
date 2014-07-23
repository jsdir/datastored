local includeLeaves = KEYS[1]
local nodePrefix = KEYS[2]
local nodeSuffix = KEYS[3]
local res

function loadTree (id)
  local sum = 0

  res = redis.call('get', nodePrefix .. id .. nodeSuffix)
  for id in res do
    -- save
    loadTree(id)
  end
end

for id in ids do
  loadTree(id)
end
