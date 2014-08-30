local rootKey = KEYS[1]

local includeLeaves = KEYS[1]
local nodePrefix = KEYS[2]
local nodeSuffix = KEYS[3]
local attributes = ARGS
local res

function loadTree (key,level)
  -- local sum = 0
  data = {}

  res = redis.call('lrange', key, 0, -1)
  for id in res do
    -- save
    data[id]
    if key < maxLevels
      newKey = childPrefix .. id
      loadTree(newKey, key + 1)
    end
  end

  return data
end

return loadTree(rootKey,1)
